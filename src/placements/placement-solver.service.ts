import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isAdmin, type RoleBearer } from '../auth/roles.util';
import { currentJalaliYear } from '../common/jalali-year';
import { IMAM_REZA_SHRINE } from '../common/shrine';
import { PrismaService } from '../prisma/prisma.service';
import { StartPlacementSolverDto } from './dto/placement-solver.dto';
import { PlacementsService } from './placements.service';
import {
  buildSolverDocument,
  eventDistanceMeters,
  originDistanceKm,
  parseCheckpointAssignments,
  parseFinalAssignments,
  type SolverAssignment,
  type SolverGender,
  type SolverGroupInput,
  type SolverPlaceInput,
} from './solver-input';

type Actor = RoleBearer & { id: string };

const DEFAULT_TIME_LIMIT_SECONDS = 30 * 60;

type RunState = {
  year: number;
  startedAt: string;
  finishedAt?: string;
  timeLimitSeconds: number;
  pid: number | null;
  phase: 'running' | 'failed' | 'stopped';
  error?: string;
};

export type PlacementSolverCaravan = {
  id: string;
  caravanId: string | null;
  label: string;
  code: string;
  name: string;
  managerName: string | null;
  managerUserId: string | null;
  managerPhone: string | null;
  men: number;
  women: number;
  originCityId: string | null;
  originCityNameFa: string | null;
  originCityNameEn: string | null;
  walkingRouteId: string | null;
  walkingRouteName: string | null;
};

export type PlacementSolverAccommodation = {
  id: string;
  name: string;
  type: SolverGender;
  placeType: 'SCHOOL' | 'MOSQUE' | 'HUSSEINIEH' | 'HALL' | 'HOUSE' | 'OTHER';
  capacity: number;
  latitude: number;
  longitude: number;
  managerName: string | null;
  managerUserId: string | null;
  managerPhone: string | null;
  address: string | null;
};

export type PlacementSolverBoard = {
  year: number;
  caravanCount: number;
  activeCaravanCount: number;
  yearCaravanCount: number;
  accommodationCount: number;
  skippedWithoutLocation: number;
  shrine: { latitude: number; longitude: number };
  caravans: PlacementSolverCaravan[];
  accommodations: PlacementSolverAccommodation[];
};

export type PlacementSolverStatus = {
  phase: 'idle' | 'running' | 'done' | 'infeasible' | 'failed' | 'stopped';
  year: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  elapsedSeconds: number;
  timeLimitSeconds: number | null;
  solutionCount: number;
  objective: number | null;
  solverStatus: 'OPTIMAL' | 'FEASIBLE' | null;
  error: string | null;
  assignments: SolverAssignment[];
};

@Injectable()
export class PlacementSolverService {
  private lastCheckpoint: {
    objective: number | null;
    solutionCount: number;
    assignments: SolverAssignment[];
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly placements: PlacementsService,
  ) {}

  async board(year: number | undefined, actor: Actor): Promise<PlacementSolverBoard> {
    this.assertAdmin(actor);
    const solvedYear = year ?? currentJalaliYear();
    const loaded = await this.loadProblem(solvedYear);
    return {
      year: solvedYear,
      caravanCount: loaded.caravans.length,
      activeCaravanCount: loaded.activeCaravanCount,
      yearCaravanCount: loaded.yearCaravanCount,
      accommodationCount: loaded.accommodationCount,
      skippedWithoutLocation: loaded.skippedWithoutLocation,
      shrine: {
        latitude: IMAM_REZA_SHRINE.latitude,
        longitude: IMAM_REZA_SHRINE.longitude,
      },
      caravans: loaded.caravans,
      accommodations: loaded.accommodations,
    };
  }

  async start(dto: StartPlacementSolverDto, actor: Actor) {
    this.assertAdmin(actor);
    const current = this.readState();
    const solverAlive = Boolean(current?.pid && isAlive(current.pid));
    const startingUp =
      current?.phase === 'running' &&
      !current.pid &&
      Date.now() - Date.parse(current.startedAt) < 3 * 60 * 1000;
    if (
      current?.phase === 'running' &&
      !this.readFinalSince(current.startedAt) &&
      (solverAlive || startingUp)
    ) {
      throw new ConflictException('یک جانمایی سیستمی در حال اجراست');
    }

    const year = dto.year ?? currentJalaliYear();
    const timeLimitSeconds = dto.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS;
    const startedAt = new Date().toISOString();
    const pending: RunState = {
      year,
      startedAt,
      timeLimitSeconds,
      pid: null,
      phase: 'running',
    };
    this.clearTemporarySolution();
    this.writeState(pending);

    let loaded: Awaited<ReturnType<PlacementSolverService['loadProblem']>>;
    try {
      loaded = await this.loadProblem(year);
    } catch (error) {
      this.failStart(pending, error instanceof Error ? error.message : 'اجرای جانمایی ناموفق بود');
      throw error;
    }
    if (!loaded.groups.length) {
      const message = 'کاروان تکمیل‌شده‌ای برای این سال نیست';
      this.failStart(pending, message);
      throw new BadRequestException(message);
    }
    if (!loaded.places.length) {
      const message = 'اسکان فعال با مختصات برای جانمایی نیست';
      this.failStart(pending, message);
      throw new BadRequestException(message);
    }

    const orToolsDir = resolveOrToolsDir();
    const runDir = path.join(orToolsDir, 'runs');
    fs.mkdirSync(runDir, { recursive: true });

    const checkpointPath = path.join(runDir, 'last_solution.json');
    const inputPath = path.join(runDir, 'input.json');
    const outputPath = path.join(runDir, 'assignments.json');
    const logPath = path.join(runDir, 'solver.log');
    const document = buildSolverDocument({
      groups: loaded.groups,
      places: loaded.places,
      timeLimitSeconds,
      checkpointPath,
    });
    fs.writeFileSync(inputPath, JSON.stringify(document, null, 2), 'utf8');

    const python = process.env.ESKAN_PYTHON || 'python';
    const script = path.join(orToolsDir, 'solver_minimal.py');
    const logFd = fs.openSync(logPath, 'w');
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(python, [script, inputPath, outputPath], {
        cwd: orToolsDir,
        detached: true,
        windowsHide: true,
        stdio: ['ignore', logFd, logFd],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
      });
    } catch (error) {
      fs.closeSync(logFd);
      const message = error instanceof Error ? error.message : 'اجرای پایتون ناموفق بود';
      this.failStart(pending, message);
      throw new BadRequestException(message);
    }
    fs.closeSync(logFd);

    const state: RunState = {
      year,
      startedAt,
      timeLimitSeconds,
      pid: child.pid ?? null,
      phase: 'running',
    };
    this.writeState(state);
    child.on('error', (error) => {
      this.writeState({
        ...state,
        phase: 'failed',
        pid: null,
        error: spawnErrorMessage(error),
      });
    });
    child.unref();

    return { year, startedAt, timeLimitSeconds };
  }

  stop(actor: Actor) {
    this.assertAdmin(actor);
    const state = this.readState();
    if (!state || state.phase !== 'running' || !state.pid || !isAlive(state.pid) || this.readFinalSince(state.startedAt)) {
      throw new BadRequestException('جانمایی در حال اجرایی نیست');
    }
    const pid = state.pid;
    try {
      killSolverProcess(pid);
    } catch {
      if (isAlive(pid)) {
        throw new BadRequestException('توقف جانمایی ناموفق بود');
      }
    }
    const finishedAt = new Date().toISOString();
    const checkpoint = this.readCheckpoint();
    this.writeState({
      ...state,
      phase: 'stopped',
      finishedAt,
      pid: null,
    });
    return {
      phase: 'stopped' as const,
      finishedAt,
      solutionCount: checkpoint?.solutionCount ?? 0,
      assignments: checkpoint?.assignments ?? [],
    };
  }

  async save(actor: Actor) {
    this.assertAdmin(actor);
    const current = this.status(actor);
    if (current.phase !== 'done' && current.phase !== 'stopped') {
      throw new BadRequestException('جانمایی تمام‌شده‌ای برای ذخیره نیست');
    }
    if (!current.assignments.length) {
      throw new BadRequestException('جوابی برای ذخیره نیست');
    }
    return this.placements.commitSystem(current.assignments, actor);
  }

  status(actor: Actor): PlacementSolverStatus {
    this.assertAdmin(actor);
    const state = this.readState();
    if (!state) return idleStatus();

    const elapsedSeconds = elapsedUntil(state.startedAt, state.finishedAt);
    const finalFile = this.readFinalSince(state.startedAt);
    if (finalFile) {
      const finishedAt = state.finishedAt ?? new Date().toISOString();
      if (!state.finishedAt) this.writeState({ ...state, finishedAt, phase: 'running' });
      const solverStatus = finalFile.status === 'OPTIMAL' ? 'OPTIMAL' : 'FEASIBLE';
      return {
        phase: 'done',
        year: state.year,
        startedAt: state.startedAt,
        finishedAt,
        elapsedSeconds: elapsedUntil(state.startedAt, finishedAt),
        timeLimitSeconds: state.timeLimitSeconds,
        solutionCount: this.readCheckpoint()?.solutionCount ?? 0,
        objective: finalFile.objective,
        solverStatus,
        error: null,
        assignments: finalFile.assignments,
      };
    }

    if (state.phase === 'stopped') {
      const checkpoint = this.readCheckpoint();
      return {
        ...baseStatus(state, elapsedSeconds),
        phase: 'stopped',
        solutionCount: checkpoint?.solutionCount ?? 0,
        objective: checkpoint?.objective ?? null,
        assignments: checkpoint?.assignments ?? [],
      };
    }

    if (state.phase === 'failed') {
      return {
        ...baseStatus(state, elapsedSeconds),
        phase: 'failed',
        error: state.error ?? 'اجرای جانمایی ناموفق بود',
        assignments: [],
      };
    }

    const starting =
      state.phase === 'running' && !state.pid && Date.now() - Date.parse(state.startedAt) < 3 * 60 * 1000;
    if ((state.pid != null && isAlive(state.pid)) || starting) {
      const checkpoint = this.readCheckpointSince(state.startedAt);
      return {
        ...baseStatus(state, elapsedSeconds),
        phase: 'running',
        solutionCount: checkpoint?.solutionCount ?? 0,
        objective: checkpoint?.objective ?? null,
        assignments: checkpoint?.assignments ?? [],
      };
    }

    const log = readLogTail();
    if (/infeasible/i.test(log)) {
      return {
        ...baseStatus(state, elapsedSeconds),
        phase: 'infeasible',
        finishedAt: state.finishedAt ?? new Date().toISOString(),
        error: null,
        assignments: this.readCheckpoint()?.assignments ?? [],
      };
    }

    return {
      ...baseStatus(state, elapsedSeconds),
      phase: 'failed',
      finishedAt: state.finishedAt ?? new Date().toISOString(),
      error: failureFromLog(log),
      assignments: this.readCheckpoint()?.assignments ?? [],
    };
  }

  private async loadProblem(year: number) {
    const [reservations, activeRows, accommodationCount, activeCaravanCount, yearCaravanCount] =
      await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          year,
          type: 'CARAVAN',
          status: 'COMPLETED',
          requestsAccommodation: true,
          OR: [{ maleCount: { gt: 0 } }, { femaleCount: { gt: 0 } }],
        },
        select: {
          id: true,
          code: true,
          maleCount: true,
          femaleCount: true,
          walkingRoute: { select: { id: true, name: true } },
          caravanManager: { select: { id: true, fullName: true, phone: true } },
          caravan: {
            select: {
              id: true,
              name: true,
              manager: { select: { id: true, fullName: true, phone: true } },
              walkingRoute: { select: { id: true, name: true } },
            },
          },
          originCity: {
            select: { id: true, nameFa: true, nameEn: true, code: true, latitude: true, longitude: true },
          },
        },
        orderBy: [{ codeSeq: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.accommodation.findMany({
        where: { status: 'ACTIVE', genderType: { in: ['MALE', 'FEMALE'] } },
        select: {
          id: true,
          name: true,
          type: true,
          genderType: true,
          maleCapacity: true,
          femaleCapacity: true,
          latitude: true,
          longitude: true,
          address: true,
          distanceToShrineKm: true,
          managers: {
            where: { year, userId: { not: null } },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            take: 1,
            select: {
              user: { select: { id: true, fullName: true, phone: true } },
            },
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.accommodation.count({ where: { status: 'ACTIVE' } }),
      this.prisma.caravan.count({
        where: {
          reservations: {
            some: {
              year,
              type: 'CARAVAN',
              status: { notIn: ['CANCELLED', 'REJECTED'] },
            },
          },
        },
      }),
      this.prisma.caravan.count({
        where: { years: { some: { year } } },
      }),
    ]);

    const caravans: PlacementSolverCaravan[] = [];
    const groups: SolverGroupInput[] = [];
    for (const row of reservations) {
      const name = row.caravan?.name?.trim() || row.code;
      const label = [row.code, row.caravan?.name].filter(Boolean).join(' ');
      const reservationManager = row.caravanManager?.fullName?.trim() ? row.caravanManager : null;
      const fallbackManager = row.caravan?.manager?.fullName?.trim() ? row.caravan.manager : null;
      const manager = reservationManager ?? fallbackManager;
      const route = row.walkingRoute ?? row.caravan?.walkingRoute ?? null;
      caravans.push({
        id: row.id,
        caravanId: row.caravan?.id ?? null,
        label,
        code: row.code,
        name,
        managerName: manager?.fullName?.trim() || null,
        managerUserId: manager?.id ?? null,
        managerPhone: manager?.phone?.trim() || null,
        men: row.maleCount,
        women: row.femaleCount,
        originCityId: row.originCity?.id ?? null,
        originCityNameFa: row.originCity?.nameFa ?? null,
        originCityNameEn: row.originCity?.nameEn ?? null,
        walkingRouteId: route?.id ?? null,
        walkingRouteName: route?.name?.trim() || null,
      });
      const latitude = toNumber(row.originCity?.latitude);
      const longitude = toNumber(row.originCity?.longitude);
      groups.push({
        id: row.id,
        men: row.maleCount,
        women: row.femaleCount,
        origin_city: row.originCity?.nameEn?.trim() || row.originCity?.code?.trim() || 'unknown',
        origin_city_distance: originDistanceKm(latitude, longitude),
      });
    }

    const accommodations: PlacementSolverAccommodation[] = [];
    const places: SolverPlaceInput[] = [];
    let skippedWithoutLocation = 0;
    for (const row of activeRows) {
      const latitude = toNumber(row.latitude);
      const longitude = toNumber(row.longitude);
      const type: SolverGender = row.genderType === 'MALE' ? 'men' : 'women';
      const capacity = type === 'men' ? row.maleCapacity : row.femaleCapacity;
      if (latitude == null || longitude == null) {
        skippedWithoutLocation += 1;
        continue;
      }
      if (capacity <= 0) continue;
      const manager = row.managers[0]?.user;
      accommodations.push({
        id: row.id,
        name: row.name,
        type,
        placeType: row.type,
        capacity,
        latitude,
        longitude,
        managerName: manager?.fullName?.trim() || null,
        managerUserId: manager?.id ?? null,
        managerPhone: manager?.phone?.trim() || null,
        address: row.address?.trim() || null,
      });
      places.push({
        id: row.id,
        type,
        capacity,
        lat: latitude,
        lng: longitude,
        event_distance: eventDistanceMeters(latitude, longitude, toNumber(row.distanceToShrineKm)),
      });
    }

    return {
      caravans,
      groups,
      accommodations,
      places,
      accommodationCount,
      activeCaravanCount,
      yearCaravanCount,
      skippedWithoutLocation,
    };
  }

  private clearTemporarySolution() {
    this.lastCheckpoint = null;
    fs.rmSync(path.join(runDir(), 'last_solution.json'), { force: true });
  }

  private failStart(state: RunState, error: string) {
    this.writeState({
      ...state,
      phase: 'failed',
      pid: null,
      finishedAt: new Date().toISOString(),
      error,
    });
  }

  private readCheckpointSince(startedAt: string) {
    const file = path.join(runDir(), 'last_solution.json');
    try {
      if (fs.statSync(file).mtimeMs + 1000 < Date.parse(startedAt)) {
        this.lastCheckpoint = null;
        return null;
      }
    } catch {
      this.lastCheckpoint = null;
      return null;
    }
    return this.readCheckpoint();
  }

  private readCheckpoint() {
    const file = path.join(runDir(), 'last_solution.json');
    const parsed = readJson(file);
    if (!parsed || typeof parsed !== 'object') {
      this.lastCheckpoint = null;
      return null;
    }
    const row = parsed as Record<string, unknown>;
    const assignments = parseCheckpointAssignments(
      row.assignments && typeof row.assignments === 'object'
        ? (row.assignments as Record<string, unknown>)
        : {},
    );
    const snapshot = {
      objective: typeof row.objective === 'number' ? row.objective : null,
      solutionCount: typeof row.solution_count === 'number' ? row.solution_count : 0,
      assignments,
    };
    this.lastCheckpoint = snapshot;
    return snapshot;
  }

  private readFinalSince(startedAt: string) {
    const file = path.join(runDir(), 'assignments.json');
    try {
      if (fs.statSync(file).mtimeMs + 1000 < Date.parse(startedAt)) return null;
    } catch {
      return null;
    }
    return this.readFinal();
  }

  private readFinal() {
    const parsed = readJson(path.join(runDir(), 'assignments.json'));
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed as Record<string, unknown>;
    const status = row.status === 'OPTIMAL' ? 'OPTIMAL' : row.status === 'FEASIBLE' ? 'FEASIBLE' : null;
    if (!status) return null;
    return {
      status,
      objective: typeof row.objective === 'number' ? row.objective : null,
      assignments: parseFinalAssignments(row.assignments),
    };
  }

  private readState(): RunState | null {
    const parsed = readJson(path.join(runDir(), 'state.json'));
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed as Partial<RunState>;
    if (typeof row.year !== 'number' || typeof row.startedAt !== 'string') return null;
    if (row.phase !== 'running' && row.phase !== 'failed' && row.phase !== 'stopped') return null;
    return {
      year: row.year,
      startedAt: row.startedAt,
      finishedAt: typeof row.finishedAt === 'string' ? row.finishedAt : undefined,
      timeLimitSeconds:
        typeof row.timeLimitSeconds === 'number' ? row.timeLimitSeconds : DEFAULT_TIME_LIMIT_SECONDS,
      pid: typeof row.pid === 'number' ? row.pid : null,
      phase: row.phase,
      error: typeof row.error === 'string' ? row.error : undefined,
    };
  }

  private writeState(state: RunState) {
    const dir = runDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'state.json');
    const temp = path.join(dir, '.state.tmp');
    fs.writeFileSync(temp, JSON.stringify(state), 'utf8');
    fs.renameSync(temp, file);
  }

  private assertAdmin(actor: Actor) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }
  }
}

function idleStatus(): PlacementSolverStatus {
  return {
    phase: 'idle',
    year: null,
    startedAt: null,
    finishedAt: null,
    elapsedSeconds: 0,
    timeLimitSeconds: null,
    solutionCount: 0,
    objective: null,
    solverStatus: null,
    error: null,
    assignments: [],
  };
}

function baseStatus(state: RunState, elapsedSeconds: number): PlacementSolverStatus {
  return {
    phase: 'idle',
    year: state.year,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt ?? null,
    elapsedSeconds,
    timeLimitSeconds: state.timeLimitSeconds,
    solutionCount: 0,
    objective: null,
    solverStatus: null,
    error: null,
    assignments: [],
  };
}

function elapsedUntil(startedAt: string, finishedAt?: string | null) {
  const start = Date.parse(startedAt);
  const end = finishedAt ? Date.parse(finishedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

function resolveOrToolsDir() {
  const candidates = [
    path.resolve(process.cwd(), 'or-tools'),
    path.resolve(process.cwd(), 'backend', 'or-tools'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'solver_minimal.py'))) return dir;
  }
  throw new BadRequestException('فایل حل‌کننده پیدا نشد');
}

function runDir() {
  return path.join(resolveOrToolsDir(), 'runs');
}

function readJson(file: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function readLogTail() {
  try {
    const text = fs.readFileSync(path.join(runDir(), 'solver.log'), 'utf8');
    return text.slice(-4000);
  } catch {
    return '';
  }
}

function killSolverProcess(pid: number) {
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    process.kill(pid, 'SIGTERM');
  }
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    return code === 'EPERM';
  }
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function spawnErrorMessage(error: Error) {
  if ('code' in error && error.code === 'ENOENT') {
    return 'پایتون پیدا نشد. مسیر آن را با متغیر ESKAN_PYTHON مشخص کنید.';
  }
  return error.message || 'اجرای پایتون ناموفق بود';
}

function failureFromLog(log: string) {
  if (/ModuleNotFoundError/.test(log) && /ortools/.test(log)) {
    return 'بسته ortools نصب نیست. در همان پایتون دستور pip install ortools را اجرا کنید.';
  }
  const line = log
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);
  if (!line || line.length > 280) return 'اجرای جانمایی ناموفق بود';
  return line;
}

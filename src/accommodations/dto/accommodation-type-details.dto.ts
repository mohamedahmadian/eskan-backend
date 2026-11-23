import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ApprovalTriState,
  AssemblyCenterKind,
  BoardingCenterKind,
  CleaningServiceKind,
  ConditionStatus,
  DrainageStatus,
  EmergencyExitStatus,
  FlooringCondition,
  KitchenStatus,
  LightingStatus,
  LinenSupplyStatus,
  LodgingCenterKind,
  MedicalActivityStatus,
  MosqueManagerLocationKind,
  SchoolKind,
  SportsComplexKind,
  TentFlooringKind,
  TentStructureKind,
  UnknownSuitabilityStatus,
  WaterSourceKind,
  WindResistanceStatus,
} from '../../generated/prisma/client';
import {
  emptyArrayToNull,
  emptyToNull,
  toOptionalNullableBoolean,
  toOptionalNumber,
} from '../../common/dto-transform';

export class RoomCapacityRowDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  capacity?: number | null;
}

export class TimeRangeRowDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;
}

export class AccommodationTypeDetailsDto {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(MedicalActivityStatus)
  medicalActivityStatus?: MedicalActivityStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  medicalAllowedSections?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  medicalForbiddenSections?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  medicalWrittenApprovalImageId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  medicalHygieneSafetyStatus?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  medicalApprovedCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  medicalSanitaryFacilities?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  medicalSpecializedRestrictions?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  medicalApproverName?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(BoardingCenterKind)
  boardingCenterKind?: BoardingCenterKind | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  boardingBlockCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  boardingRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  boardingFixedBedCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  boardingUsableBedCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  boardingPrivateBathroomRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  boardingSharedBathToiletCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  boardingHasDiningHall?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  boardingHasKitchen?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  boardingHasLaundry?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  boardingHasStudyOrHall?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  boardingAccessControl?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  boardingPersonalStorage?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  boardingCanAssignFully?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  boardingUnassignableSections?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  boardingApprovedCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  boardingRepresentativeName?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(TentStructureKind)
  tentStructureKind?: TentStructureKind | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  tentInstalledCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  tentIntactCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  tentApprovedCapacityEach?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  tentAreaEach?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(TentFlooringKind)
  tentFlooringKind?: TentFlooringKind | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(DrainageStatus)
  tentDrainageStatus?: DrainageStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(WindResistanceStatus)
  tentWindResistanceStatus?: WindResistanceStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  tentHvacStatus?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(WaterSourceKind)
  tentWaterSource?: WaterSourceKind | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  tentWaterHealthStatus?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  tentToiletCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  tentWasteLocation?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(LightingStatus)
  tentPublicLighting?: LightingStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(LightingStatus)
  tentExitPathLighting?: LightingStatus | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  tentEmergencyVehicleAccess?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  tentSafeAssemblyPoint?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  tentFireEquipment?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  tentMaintenanceManager?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  tentFinalApprovedCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(LodgingCenterKind)
  lodgingCenterKind?: LodgingCenterKind | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingBuildingCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingFloorCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingFixedBedCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingUsableBedCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingSingleRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingMultiRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyArrayToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomCapacityRowDto)
  lodgingRoomCapacities?: RoomCapacityRowDto[] | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingAssignableRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingOutOfServiceRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingPrivateBathroomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingSharedBathroomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingBathCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(LinenSupplyStatus)
  lodgingLinenStatus?: LinenSupplyStatus | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  lodgingCanWashLinen?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  lodgingHvacStatus?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingElevatorCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  lodgingElevatorStatus?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  lodgingStepFreeAccess?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  lodgingLuggageStorage?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(CleaningServiceKind)
  lodgingCleaningService?: CleaningServiceKind | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  lodgingNightReception?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  lodgingLockStatus?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  lodgingOperationTerms?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  lodgingRoomEquipment?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  lodgingFinalApprovedCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(AssemblyCenterKind)
  assemblyCenterKind?: AssemblyCenterKind | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  assemblyMainHallArea?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  assemblySideHallCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  assemblyFixedSeatCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  assemblySeatsRemovable?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  assemblyUsableAreaAfterRemoval?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  assemblySideRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  assemblyHasStage?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  assemblyHasBackstage?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  assemblyToiletCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  assemblyAvSystem?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(ConditionStatus)
  assemblyVentilationStatus?: ConditionStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  assemblyAvStorage?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  assemblyEventSchedule?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  assemblyCanSplitSpace?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  assemblyFinalApprovedCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  assemblyOperatorRestrictions?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(SportsComplexKind)
  sportsComplexKind?: SportsComplexKind | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  sportsOperatorName?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  sportsMainFloorArea?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  sportsIndependentHallCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  sportsSpectatorSeatCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(ApprovalTriState)
  sportsSpectatorStayUse?: ApprovalTriState | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  sportsShowerCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  sportsToiletCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  sportsEntryExitCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(EmergencyExitStatus)
  sportsEmergencyExitStatus?: EmergencyExitStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(FlooringCondition)
  sportsFlooringCondition?: FlooringCondition | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  sportsFloorCovering?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  sportsHasEquipmentStorage?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  sportsVentilation?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  sportsHvacStatus?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(UnknownSuitabilityStatus)
  sportsEmergencyLighting?: UnknownSuitabilityStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  sportsFireStatus?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  sportsProposedCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  sportsFinalApprovedCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  sportsHasReceptionDesk?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  husseiniehManagerName?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  husseiniehMainHallArea?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  husseiniehSideHallCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  husseiniehSideHallAreas?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  husseiniehFloorCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  husseiniehBalconyCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(ApprovalTriState)
  husseiniehBalconyStayUse?: ApprovalTriState | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  husseiniehMainHallCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  husseiniehSideRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  husseiniehHasStaffRoom?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  husseiniehHasStorage?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  husseiniehHasKitchen?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(KitchenStatus)
  husseiniehKitchenStatus?: KitchenStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(ConditionStatus)
  husseiniehAudioStatus?: ConditionStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyArrayToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeRangeRowDto)
  husseiniehCeremonyHours?: TimeRangeRowDto[] | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  husseiniehGenderSeparation?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  husseiniehToiletStatus?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(ConditionStatus)
  husseiniehVentilationStatus?: ConditionStatus | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  husseiniehCanBringSupplies?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  husseiniehTrusteeRestrictions?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  mosqueTrusteeName?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  mosqueHallCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  mosqueFloorCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  mosqueAssignableArea?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  mosqueHallApprovedCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  mosqueHasSistersSpace?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  mosqueHasBrothersSpace?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyArrayToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeRangeRowDto)
  mosqueBanHours?: TimeRangeRowDto[] | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  mosqueReligiousSchedule?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  mosqueToiletCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  mosqueAblutionCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(UnknownSuitabilityStatus)
  mosqueHotWaterStatus?: UnknownSuitabilityStatus | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  mosqueHasShoeStorage?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNullableBoolean(value))
  @ValidateIf((_, value) => value != null)
  @IsBoolean()
  mosqueHasStorage?: boolean | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  mosqueKitchenRestriction?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  mosqueSpeakerRestriction?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  mosqueTrusteeRules?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(MosqueManagerLocationKind)
  mosqueManagerLocationKind?: MosqueManagerLocationKind | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  mosqueManagerLocationText?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(SchoolKind)
  schoolKind?: SchoolKind | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolFloorCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolBuildingCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolTotalClassroomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolUsableClassroomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolUsableHallCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolPrayerRoomCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolAssignableOfficeCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolClassroomApprovedCapacity?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolAllowedStayFloors?: number | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(0)
  schoolToiletCount?: number | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(ConditionStatus)
  schoolWashStatus?: ConditionStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsEnum(ConditionStatus)
  schoolHvacStatus?: ConditionStatus | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  schoolManagerUserId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  schoolManagerName?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  schoolEquipmentHandoverImageId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  schoolFinalHandoverImageId?: string | null;
}

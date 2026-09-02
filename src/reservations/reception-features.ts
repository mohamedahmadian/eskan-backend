import { ReceptionFeature, ReservationType } from '../generated/prisma/client';

export const receptionFeatures = {
  MASHHAD_PLACEMENT: ReceptionFeature.MASHHAD_PLACEMENT,
  ROUTE_PLACEMENT: ReceptionFeature.ROUTE_PLACEMENT,
  COMPANIONS: ReceptionFeature.COMPANIONS,
  INSURANCE: ReceptionFeature.INSURANCE,
  INDIVIDUAL: ReceptionFeature.INDIVIDUAL,
  GROUP: ReceptionFeature.GROUP,
  CARAVAN: ReceptionFeature.CARAVAN,
  CARAVAN_CONTACTS: ReceptionFeature.CARAVAN_CONTACTS,
} as const;

export type ReservationFeatures = {
  companions: boolean;
  insurance: boolean;
  mashhadPlacement: boolean;
  routePlacement: boolean;
  caravanContacts: boolean;
};

export const defaultIranianFeatures: ReservationFeatures = {
  companions: true,
  insurance: true,
  mashhadPlacement: true,
  routePlacement: true,
  caravanContacts: true,
};

export type FeatureCountryLists = {
  mashhadPlacementCountryIds: string[];
  routePlacementCountryIds: string[];
  companionsCountryIds: string[];
  insuranceCountryIds: string[];
  individualCountryIds: string[];
  groupCountryIds: string[];
  caravanCountryIds: string[];
  caravanContactsCountryIds: string[];
};

export const emptyFeatureCountryLists = (): FeatureCountryLists => ({
  mashhadPlacementCountryIds: [],
  routePlacementCountryIds: [],
  companionsCountryIds: [],
  insuranceCountryIds: [],
  individualCountryIds: [],
  groupCountryIds: [],
  caravanCountryIds: [],
  caravanContactsCountryIds: [],
});

export const receptionCountryBindings: {
  key: keyof FeatureCountryLists;
  feature: ReceptionFeature;
}[] = [
  { key: 'mashhadPlacementCountryIds', feature: ReceptionFeature.MASHHAD_PLACEMENT },
  { key: 'routePlacementCountryIds', feature: ReceptionFeature.ROUTE_PLACEMENT },
  { key: 'companionsCountryIds', feature: ReceptionFeature.COMPANIONS },
  { key: 'insuranceCountryIds', feature: ReceptionFeature.INSURANCE },
  { key: 'individualCountryIds', feature: ReceptionFeature.INDIVIDUAL },
  { key: 'groupCountryIds', feature: ReceptionFeature.GROUP },
  { key: 'caravanCountryIds', feature: ReceptionFeature.CARAVAN },
  { key: 'caravanContactsCountryIds', feature: ReceptionFeature.CARAVAN_CONTACTS },
];

export function featuresFromCountryLists(
  originCountryId: string | null | undefined,
  lists: Pick<
    FeatureCountryLists,
    | 'mashhadPlacementCountryIds'
    | 'routePlacementCountryIds'
    | 'companionsCountryIds'
    | 'insuranceCountryIds'
    | 'caravanContactsCountryIds'
  >,
): ReservationFeatures {
  const id = originCountryId ?? '';
  const has = (ids: string[]) => Boolean(id && ids.includes(id));
  return {
    mashhadPlacement: has(lists.mashhadPlacementCountryIds),
    routePlacement: has(lists.routePlacementCountryIds),
    companions: has(lists.companionsCountryIds),
    insurance: has(lists.insuranceCountryIds),
    caravanContacts: has(lists.caravanContactsCountryIds),
  };
}

export const receptionFeatureKeys = [
  'mashhadPlacement',
  'routePlacement',
  'companions',
  'insurance',
  'caravanContacts',
] as const;

export type ReceptionFeatureKey = (typeof receptionFeatureKeys)[number];

export function featureEnumFromKey(key: ReceptionFeatureKey): ReceptionFeature {
  if (key === 'mashhadPlacement') return ReceptionFeature.MASHHAD_PLACEMENT;
  if (key === 'routePlacement') return ReceptionFeature.ROUTE_PLACEMENT;
  if (key === 'companions') return ReceptionFeature.COMPANIONS;
  if (key === 'caravanContacts') return ReceptionFeature.CARAVAN_CONTACTS;
  return ReceptionFeature.INSURANCE;
}

export function featureKeyFromEnum(feature: ReceptionFeature): ReceptionFeatureKey | null {
  if (feature === ReceptionFeature.MASHHAD_PLACEMENT) return 'mashhadPlacement';
  if (feature === ReceptionFeature.ROUTE_PLACEMENT) return 'routePlacement';
  if (feature === ReceptionFeature.COMPANIONS) return 'companions';
  if (feature === ReceptionFeature.INSURANCE) return 'insurance';
  if (feature === ReceptionFeature.CARAVAN_CONTACTS) return 'caravanContacts';
  return null;
}

export function typeCountryIdsKey(
  type: ReservationType,
): 'individualCountryIds' | 'groupCountryIds' | 'caravanCountryIds' {
  if (type === ReservationType.INDIVIDUAL) return 'individualCountryIds';
  if (type === ReservationType.GROUP) return 'groupCountryIds';
  return 'caravanCountryIds';
}

export function isTypeAllowedForCountry(
  type: ReservationType,
  originCountryId: string | null | undefined,
  lists: FeatureCountryLists,
): boolean {
  if (!originCountryId) return true;
  return lists[typeCountryIdsKey(type)].includes(originCountryId);
}

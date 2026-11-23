export const medicalDetailKeys = [
  'medicalActivityStatus',
  'medicalAllowedSections',
  'medicalForbiddenSections',
  'medicalWrittenApprovalImageId',
  'medicalHygieneSafetyStatus',
  'medicalApprovedCapacity',
  'medicalSanitaryFacilities',
  'medicalSpecializedRestrictions',
  'medicalApproverName',
] as const;

export const boardingDetailKeys = [
  'boardingCenterKind',
  'boardingBlockCount',
  'boardingRoomCount',
  'boardingFixedBedCount',
  'boardingUsableBedCount',
  'boardingPrivateBathroomRoomCount',
  'boardingSharedBathToiletCount',
  'boardingHasDiningHall',
  'boardingHasKitchen',
  'boardingHasLaundry',
  'boardingHasStudyOrHall',
  'boardingAccessControl',
  'boardingPersonalStorage',
  'boardingCanAssignFully',
  'boardingUnassignableSections',
  'boardingApprovedCapacity',
  'boardingRepresentativeName',
] as const;

export const tentDetailKeys = [
  'tentStructureKind',
  'tentInstalledCount',
  'tentIntactCount',
  'tentApprovedCapacityEach',
  'tentAreaEach',
  'tentFlooringKind',
  'tentDrainageStatus',
  'tentWindResistanceStatus',
  'tentHvacStatus',
  'tentWaterSource',
  'tentWaterHealthStatus',
  'tentToiletCount',
  'tentWasteLocation',
  'tentPublicLighting',
  'tentExitPathLighting',
  'tentEmergencyVehicleAccess',
  'tentSafeAssemblyPoint',
  'tentFireEquipment',
  'tentMaintenanceManager',
  'tentFinalApprovedCapacity',
] as const;

export const lodgingDetailKeys = [
  'lodgingCenterKind',
  'lodgingBuildingCount',
  'lodgingFloorCount',
  'lodgingRoomCount',
  'lodgingFixedBedCount',
  'lodgingUsableBedCount',
  'lodgingSingleRoomCount',
  'lodgingMultiRoomCount',
  'lodgingRoomCapacities',
  'lodgingAssignableRoomCount',
  'lodgingOutOfServiceRoomCount',
  'lodgingPrivateBathroomCount',
  'lodgingSharedBathroomCount',
  'lodgingBathCount',
  'lodgingLinenStatus',
  'lodgingCanWashLinen',
  'lodgingHvacStatus',
  'lodgingElevatorCount',
  'lodgingElevatorStatus',
  'lodgingStepFreeAccess',
  'lodgingLuggageStorage',
  'lodgingCleaningService',
  'lodgingNightReception',
  'lodgingLockStatus',
  'lodgingOperationTerms',
  'lodgingRoomEquipment',
  'lodgingFinalApprovedCapacity',
] as const;

export const assemblyDetailKeys = [
  'assemblyCenterKind',
  'assemblyMainHallArea',
  'assemblySideHallCount',
  'assemblyFixedSeatCount',
  'assemblySeatsRemovable',
  'assemblyUsableAreaAfterRemoval',
  'assemblySideRoomCount',
  'assemblyHasStage',
  'assemblyHasBackstage',
  'assemblyToiletCount',
  'assemblyAvSystem',
  'assemblyVentilationStatus',
  'assemblyAvStorage',
  'assemblyEventSchedule',
  'assemblyCanSplitSpace',
  'assemblyFinalApprovedCapacity',
  'assemblyOperatorRestrictions',
] as const;

export const sportsDetailKeys = [
  'sportsComplexKind',
  'sportsOperatorName',
  'sportsMainFloorArea',
  'sportsIndependentHallCount',
  'sportsSpectatorSeatCount',
  'sportsSpectatorStayUse',
  'sportsShowerCount',
  'sportsToiletCount',
  'sportsEntryExitCount',
  'sportsEmergencyExitStatus',
  'sportsFlooringCondition',
  'sportsFloorCovering',
  'sportsHasEquipmentStorage',
  'sportsVentilation',
  'sportsHvacStatus',
  'sportsEmergencyLighting',
  'sportsFireStatus',
  'sportsProposedCapacity',
  'sportsFinalApprovedCapacity',
  'sportsHasReceptionDesk',
] as const;

export const husseiniehDetailKeys = [
  'husseiniehManagerName',
  'husseiniehMainHallArea',
  'husseiniehSideHallCount',
  'husseiniehSideHallAreas',
  'husseiniehFloorCount',
  'husseiniehBalconyCount',
  'husseiniehBalconyStayUse',
  'husseiniehMainHallCapacity',
  'husseiniehSideRoomCount',
  'husseiniehHasStaffRoom',
  'husseiniehHasStorage',
  'husseiniehHasKitchen',
  'husseiniehKitchenStatus',
  'husseiniehAudioStatus',
  'husseiniehCeremonyHours',
  'husseiniehGenderSeparation',
  'husseiniehToiletStatus',
  'husseiniehVentilationStatus',
  'husseiniehCanBringSupplies',
  'husseiniehTrusteeRestrictions',
] as const;

export const mosqueDetailKeys = [
  'mosqueTrusteeName',
  'mosqueHallCount',
  'mosqueFloorCount',
  'mosqueAssignableArea',
  'mosqueHallApprovedCapacity',
  'mosqueHasSistersSpace',
  'mosqueHasBrothersSpace',
  'mosqueBanHours',
  'mosqueReligiousSchedule',
  'mosqueToiletCount',
  'mosqueAblutionCount',
  'mosqueHotWaterStatus',
  'mosqueHasShoeStorage',
  'mosqueHasStorage',
  'mosqueKitchenRestriction',
  'mosqueSpeakerRestriction',
  'mosqueTrusteeRules',
  'mosqueManagerLocationKind',
  'mosqueManagerLocationText',
] as const;

export const schoolDetailKeys = [
  'schoolKind',
  'schoolFloorCount',
  'schoolBuildingCount',
  'schoolTotalClassroomCount',
  'schoolUsableClassroomCount',
  'schoolUsableHallCount',
  'schoolPrayerRoomCount',
  'schoolAssignableOfficeCount',
  'schoolClassroomApprovedCapacity',
  'schoolAllowedStayFloors',
  'schoolToiletCount',
  'schoolWashStatus',
  'schoolHvacStatus',
  'schoolManagerUserId',
  'schoolManagerName',
  'schoolEquipmentHandoverImageId',
  'schoolFinalHandoverImageId',
] as const;

export const typeDetailKeysByKind = {
  medical: medicalDetailKeys,
  boarding: boardingDetailKeys,
  tent: tentDetailKeys,
  lodging: lodgingDetailKeys,
  'assembly-hall': assemblyDetailKeys,
  'sports-hall': sportsDetailKeys,
  husseinieh: husseiniehDetailKeys,
  mosque: mosqueDetailKeys,
  school: schoolDetailKeys,
} as const;

export type AccommodationTypeDetailKind = keyof typeof typeDetailKeysByKind;

export const accommodationTypeDetailKeys = [
  ...medicalDetailKeys,
  ...boardingDetailKeys,
  ...tentDetailKeys,
  ...lodgingDetailKeys,
  ...assemblyDetailKeys,
  ...sportsDetailKeys,
  ...husseiniehDetailKeys,
  ...mosqueDetailKeys,
  ...schoolDetailKeys,
] as const;

export type AccommodationTypeDetailKey =
  (typeof accommodationTypeDetailKeys)[number];

export const typeDetailImageKeys = [
  'medicalWrittenApprovalImageId',
  'schoolEquipmentHandoverImageId',
  'schoolFinalHandoverImageId',
] as const;

export function accommodationTypeDetailKind(
  type: { code?: string | null } | string | null | undefined,
): AccommodationTypeDetailKind | null {
  const code = typeof type === 'string' ? type : type?.code;
  if (code && code in typeDetailKeysByKind) {
    return code as AccommodationTypeDetailKind;
  }
  return null;
}

export function isSchoolAccommodationType(
  type: { code?: string | null } | string | null | undefined,
) {
  return accommodationTypeDetailKind(type) === 'school';
}

export function typeDetailKeysToClear(
  kind: AccommodationTypeDetailKind | null,
): AccommodationTypeDetailKey[] {
  const keep = new Set(
    kind ? (typeDetailKeysByKind[kind] as readonly string[]) : [],
  );
  return accommodationTypeDetailKeys.filter((key) => !keep.has(key));
}

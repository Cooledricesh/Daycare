import {
  BP_CLASSIFICATIONS,
  BP_CONFIG,
  BS_CLASSIFICATIONS,
  BS_CONFIG,
  type BPClassification,
  type BSClassification,
} from '../constants/vitals-ranges';

type VitalsClassificationResult<T extends string> = {
  status: T;
  label: string;
  color: string;
  bgColor: string;
};

export function classifyBloodPressure(
  systolic: number,
  diastolic: number,
): VitalsClassificationResult<BPClassification> {
  const classify = (): BPClassification => {
    if (systolic >= 180 || diastolic >= 120) return BP_CLASSIFICATIONS.CRISIS;
    if (systolic >= 140 || diastolic >= 90) return BP_CLASSIFICATIONS.STAGE2;
    if (systolic >= 130 || diastolic >= 80) return BP_CLASSIFICATIONS.STAGE1;
    if (systolic >= 120 && diastolic < 80) return BP_CLASSIFICATIONS.ELEVATED;
    return BP_CLASSIFICATIONS.NORMAL;
  };

  const status = classify();
  const config = BP_CONFIG[status];
  return { status, label: config.label, color: config.color, bgColor: config.bgColor };
}

export function classifyBloodSugar(
  value: number,
): VitalsClassificationResult<BSClassification> {
  const classify = (): BSClassification => {
    if (value < 70) return BS_CLASSIFICATIONS.LOW;
    if (value < 100) return BS_CLASSIFICATIONS.NORMAL;
    if (value < 126) return BS_CLASSIFICATIONS.PREDIABETES;
    return BS_CLASSIFICATIONS.DIABETES;
  };

  const status = classify();
  const config = BS_CONFIG[status];
  return { status, label: config.label, color: config.color, bgColor: config.bgColor };
}

export function isAbnormalBP(systolic: number, diastolic: number): boolean {
  const { status } = classifyBloodPressure(systolic, diastolic);
  return status !== BP_CLASSIFICATIONS.NORMAL && status !== BP_CLASSIFICATIONS.ELEVATED;
}

export function isAbnormalBS(value: number): boolean {
  const { status } = classifyBloodSugar(value);
  return status !== BS_CLASSIFICATIONS.NORMAL;
}

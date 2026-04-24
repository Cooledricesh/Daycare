/** 리포트 가능 시작 연도 */
export const REPORT_MIN_YEAR = 2026;

/** 리포트 가능 시작 월 (2026-03) */
export const REPORT_MIN_MONTH = 3;

/** 출석 우수 상위 인원 수 */
export const TOP_ATTENDERS_COUNT = 10;

/** 집중 관리 대상 최대 인원 수 */
export const RISK_PATIENTS_MAX_COUNT = 10;

/** 집중 관리 대상: 출석률 임계치 (%) */
export const RISK_ATTENDANCE_RATE_THRESHOLD = 50;

/** 집중 관리 대상: 최장 연속 결석 임계치 (일) */
export const RISK_CONSECUTIVE_ABSENCE_DAYS = 5;

/** 코디별 연속 3일+ 결석 판정 기준 (일) */
export const COORDINATOR_CONSECUTIVE_ABSENCE_DAYS = 3;

/** 출석 우수: 최소 재원 기간 (일) - 이 이하면 우수 목록 제외 */
export const TOP_ATTENDERS_MIN_POSSIBLE_DAYS = 10;

/** 이상치 판정: 표준편차 배수 */
export const OUTLIER_SIGMA_MULTIPLIER = 2;

/** 액션 아이템 최대 길이 */
export const ACTION_ITEMS_MAX_LENGTH = 5000;

// backend/schema의 타입과 스키마를 프론트엔드에 재노출합니다
export type {
  WeeklyTrendEntry,
  WeekdayAvg,
  PrevMonthComparison,
  CoordinatorPerformanceEntry,
  TopAttenderEntry,
  RiskPatientEntry,
  NewPatientEntry,
  DischargeEntry,
  PatientSegments,
  ConsultationStats,
  SpecialNoteEntry,
  MonthlyReportResponse,
  MonthlyReportListItem,
  MonthlyReportParams,
  ActionItemsUpdate,
} from '../backend/schema';

export {
  MonthlyReportResponseSchema,
  MonthlyReportListItemSchema,
  MonthlyReportParamsSchema,
  ActionItemsUpdateSchema,
} from '../backend/schema';

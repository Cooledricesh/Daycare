/**
 * 환자 표시명을 반환합니다.
 * display_name이 있으면 사용하고, 없으면 name을 반환합니다.
 */
export function getPatientDisplayName(patient: { name: string; display_name?: string | null }): string {
  return patient.display_name || patient.name;
}

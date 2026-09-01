import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('전체 역할 환자 히스토리 접근 계약', () => {
  it.each([
    'src/app/dashboard/doctor/history/[id]/page.tsx',
    'src/app/dashboard/admin/history/[id]/page.tsx',
    'src/app/dashboard/nurse/history/[id]/page.tsx',
    'src/app/dashboard/staff/history/[id]/page.tsx',
  ])('%s에서 공용 전체 히스토리 화면을 사용한다', (pagePath) => {
    expect(fs.existsSync(path.join(root, pagePath))).toBe(true);
    expect(read(pagePath)).toContain('PatientFullHistoryPage');
  });

  it.each([
    'src/features/doctor/components/ConsultationPanel.tsx',
    'src/features/admin/components/PatientsTable.tsx',
    'src/features/admin/components/AdminDetailPanel.tsx',
    'src/features/nurse/components/NurseDetailPanel.tsx',
    'src/features/staff/components/StaffDetailPanel.tsx',
  ])('%s에 전체 히스토리 버튼이 있다', (sourcePath) => {
    expect(read(sourcePath)).toContain('PatientHistoryButton');
  });

  it('공용 API를 통해 모든 허용 역할이 같은 히스토리 응답을 사용한다', () => {
    expect(read('src/features/doctor/hooks/usePatientHistory.ts')).toContain('/api/shared/patient/');
    expect(read('src/features/shared/backend/route.ts')).toContain("sharedRoutes.get('/patient/:id/history'");
  });
});

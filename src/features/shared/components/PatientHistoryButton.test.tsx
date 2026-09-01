import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PatientHistoryButton } from './PatientHistoryButton';

describe('PatientHistoryButton', () => {
  it.each([
    ['doctor', '/dashboard/doctor/history/patient-1'],
    ['admin', '/dashboard/admin/history/patient-1'],
    ['nurse', '/dashboard/nurse/history/patient-1'],
    ['coordinator', '/dashboard/staff/history/patient-1'],
  ] as const)('%s 역할의 전체 히스토리 경로를 만든다', (role, href) => {
    render(<PatientHistoryButton role={role} patientId="patient-1" />);

    expect(screen.getByRole('link', { name: '전체 히스토리' })).toHaveAttribute('href', href);
  });
});

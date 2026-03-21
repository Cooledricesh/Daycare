-- 2026-03-19 진찰 기록은 있는데 출석 기록이 누락된 환자 79명 복원
-- 원인: 직원이 batchCancelAttendance로 진찰 완료 환자의 출석을 삭제함
INSERT INTO attendances (patient_id, date, checked_at)
SELECT c.patient_id, c.date, c.created_at
FROM consultations c
LEFT JOIN attendances a ON c.patient_id = a.patient_id AND c.date = a.date
WHERE c.date = '2026-03-19' AND a.id IS NULL
ON CONFLICT (patient_id, date) DO NOTHING;

-- 복원 후 3/19 daily_stats 재계산
UPDATE daily_stats
SET
  attendance_count = (SELECT COUNT(*) FROM attendances WHERE date = '2026-03-19'),
  attendance_rate = LEAST(
    ROUND((SELECT COUNT(*) FROM attendances WHERE date = '2026-03-19')::numeric
      / NULLIF(scheduled_count, 0) * 100, 2),
    100
  ),
  consultation_rate_vs_attendance = LEAST(
    ROUND(consultation_count::numeric
      / NULLIF((SELECT COUNT(*) FROM attendances WHERE date = '2026-03-19'), 0) * 100, 2),
    100
  ),
  calculated_at = NOW()
WHERE date = '2026-03-19';

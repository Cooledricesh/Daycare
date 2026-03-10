-- messages 테이블에 중복 방지 UNIQUE 인덱스 추가
-- 동일한 환자에 대해 같은 날짜, 같은 작성자, 같은 내용의 메시지가 중복 삽입되는 것을 방지
-- content가 TEXT이므로 md5 해시를 사용하여 인덱스 크기 최적화

-- 1. 기존 중복 데이터 제거 (가장 오래된 레코드만 보존)
DELETE FROM messages
WHERE id NOT IN (
  SELECT DISTINCT ON (patient_id, date, author_id, md5(content)) id
  FROM messages
  ORDER BY patient_id, date, author_id, md5(content), created_at ASC
);

-- 2. UNIQUE 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_no_duplicate
  ON messages (patient_id, date, author_id, md5(content));

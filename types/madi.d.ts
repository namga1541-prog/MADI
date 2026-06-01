// MADI 공용 타입 정의 (ambient — import/export 없음 → 전역 스크립트에서 그대로 사용)
//
// 목적: .js 파일에서 JSDoc `@type {Child}` / `@param {string} childId` 로 참조해
//       에디터가 타입을 검사·자동완성하게 한다. 런타임 영향 0 (이 파일은 앱에 로드되지 않음).
//
// ⚠️ 가장 중요한 규칙: 모든 id 는 string 이다. parseInt(id) / 숫자 비교 = 회귀 버그.

/** 모든 엔티티 id 의 타입 — 항상 문자열 */
type MadiId = string;

/** 역할 */
type MadiRole = 'superadmin' | 'admin' | 'teacher' | 'parent';

/** 세션 목표 1건 */
interface Goal {
  name: string;
  /** 점수 0~100, 미입력 시 null */
  score: number | null;
}

/** 아동 (madi_children.data) */
interface Child {
  id: MadiId;
  name: string;
  birth?: string;        // 'YYYY-MM-DD'
  age?: string | number;
  type?: string;
  phone?: string;
  status?: string;       // 예: '진행' | '종결' (madi_users 의 status 와 무관 — 그 컬럼은 없음)
  startDate?: string;
  closedAt?: string;
  closedReason?: string;
  voucherLimit?: number;
  voucherType?: string;
  color?: string;
  goals?: Goal[];
  memo?: string;
  [k: string]: any;      // data JSONB — 그 외 필드 허용
}

/** 세션 기록 (madi_sessions.data) */
interface Session {
  id: MadiId;
  childId: MadiId;
  date: string;          // 'YYYY-MM-DD'
  teacher?: string;
  teacher_id?: MadiId;
  goals?: Goal[];
  memo?: string;
  aiNote?: string;
  phonemes?: Record<string, any>;
  [k: string]: any;
}

/** 일정 (madi_schedules) */
interface Schedule {
  id: MadiId;
  childId?: MadiId;
  child_id?: MadiId;
  date: string;
  startTime?: string;
  endTime?: string;
  teacher?: string;
  note?: string;
  [k: string]: any;
}

/** 사용자 (madi_users) — ⚠️ status 컬럼 없음 */
interface MadiUser {
  id: MadiId;
  username: string;
  name: string;
  role: MadiRole;
  center_id: MadiId;
  color?: string;
  permissions?: Record<string, boolean>;
  prog_types?: string[];
  totp_enabled?: boolean;
  [k: string]: any;
}

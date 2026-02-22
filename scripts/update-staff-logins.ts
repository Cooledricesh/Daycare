import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing Supabase environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const PASSWORD = "1234";

// 기존 코디네이터: login_id를 사번으로 변경
const staffUpdates = [
    { name: "안중현", role: "coordinator", new_login_id: "582900" },
    { name: "김세훈", role: "coordinator", new_login_id: "583100" },
    { name: "김용덕", role: "coordinator", new_login_id: "583200" },
    { name: "권은경", role: "coordinator", new_login_id: "584400" },
    { name: "김세은", role: "coordinator", new_login_id: "584500" },
    { name: "조희숙", role: "coordinator", new_login_id: "622000" },
    { name: "배수현", role: "coordinator", new_login_id: "631300" },
    { name: "박지예", role: "coordinator", new_login_id: "638000" },
    { name: "이관수", role: "coordinator", new_login_id: "645300" },
];

// 신규 스태프
const staffCreates = [
    { login_id: "289881", name: "신순희", role: "coordinator" as const },
    { login_id: "551100", name: "김도연", role: "coordinator" as const },
    { login_id: "582600", name: "나선화", role: "coordinator" as const },
    { login_id: "584300", name: "이애숙", role: "coordinator" as const },
    { login_id: "584600", name: "김소연", role: "coordinator" as const },
    { login_id: "618800", name: "공종하", role: "coordinator" as const },
    { login_id: "620360", name: "김민경", role: "nurse" as const },
    { login_id: "624000", name: "백종민", role: "coordinator" as const },
    { login_id: "625300", name: "이상배", role: "coordinator" as const },
    { login_id: "626500", name: "오호정", role: "nurse" as const },
];

async function updateStaffLoginIds() {
    console.log("=== 기존 스태프 login_id 변경 ===\n");
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    for (const staff of staffUpdates) {
        const { data: existing, error: findError } = await supabase
            .from("staff")
            .select("id, login_id")
            .eq("name", staff.name)
            .eq("role", staff.role)
            .single();

        if (findError || !existing) {
            console.error(`✗ ${staff.name} (${staff.role}) 찾을 수 없음`);
            continue;
        }

        const { error: updateError } = await supabase
            .from("staff")
            .update({
                login_id: staff.new_login_id,
                password_hash: passwordHash,
            })
            .eq("id", existing.id);

        if (updateError) {
            console.error(`✗ ${staff.name}: ${updateError.message}`);
        } else {
            console.log(`✓ ${staff.name}: ${existing.login_id} → ${staff.new_login_id}`);
        }
    }
}

async function createNewStaff() {
    console.log("\n=== 신규 스태프 등록 ===\n");
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    for (const staff of staffCreates) {
        const { error } = await supabase
            .from("staff")
            .upsert(
                {
                    login_id: staff.login_id,
                    password_hash: passwordHash,
                    name: staff.name,
                    role: staff.role,
                    is_active: true,
                },
                { onConflict: "login_id" }
            )
            .select()
            .single();

        if (error) {
            console.error(`✗ ${staff.name} (${staff.login_id}): ${error.message}`);
        } else {
            const roleLabel = staff.role === "nurse" ? "간호사" : "코디";
            console.log(`✓ ${staff.name} (${staff.login_id}) - ${roleLabel}`);
        }
    }
}

async function main() {
    await updateStaffLoginIds();
    await createNewStaff();
    console.log("\n완료!");
}

main();

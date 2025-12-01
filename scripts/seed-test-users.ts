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

interface TestUser {
    login_id: string;
    password: string;
    name: string;
    role: "admin" | "doctor" | "coordinator" | "nurse";
}

const testUsers: TestUser[] = [
    { login_id: "admin", password: "admin1234", name: "관리자", role: "admin" },
    { login_id: "doctor", password: "doctor1234", name: "김의사", role: "doctor" },
    { login_id: "coordinator", password: "coord1234", name: "박코디", role: "coordinator" },
    { login_id: "nurse", password: "nurse1234", name: "이간호", role: "nurse" },
];

async function seedTestUsers() {
    console.log("Creating test users...\n");

    for (const user of testUsers) {
        const passwordHash = await bcrypt.hash(user.password, 10);

        const { data, error } = await supabase
            .from("staff")
            .upsert(
                {
                    login_id: user.login_id,
                    password_hash: passwordHash,
                    name: user.name,
                    role: user.role,
                    is_active: true,
                },
                { onConflict: "login_id" }
            )
            .select()
            .single();

        if (error) {
            console.error(`Error creating ${user.role} user:`, error);
        } else {
            console.log(`✓ ${user.role.toUpperCase()} user created`);
            console.log(`  Login ID: ${user.login_id}`);
            console.log(`  Password: ${user.password}`);
            console.log(`  Name: ${user.name}\n`);
        }
    }

    console.log("Done!");
}

seedTestUsers();

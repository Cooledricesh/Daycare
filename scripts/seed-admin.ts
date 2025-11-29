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

async function seedAdmin() {
    const loginId = "admin";
    const password = "admin1234"; // Default password
    const name = "관리자";

    console.log(`Creating admin user: ${loginId}`);

    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
        .from("staff")
        .upsert(
            {
                login_id: loginId,
                password_hash: passwordHash,
                name: name,
                role: "admin",
                is_active: true,
            },
            { onConflict: "login_id" }
        )
        .select()
        .single();

    if (error) {
        console.error("Error creating admin user:", error);
    } else {
        console.log("Admin user created successfully:", data);
        console.log(`Login ID: ${loginId}`);
        console.log(`Password: ${password}`);
    }
}

seedAdmin();

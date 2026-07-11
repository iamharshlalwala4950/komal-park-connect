import { supabase } from "../../services/supabase";

export async function login(email, password) {

    const { data, error } =
        await supabase.auth.signInWithPassword({

            email,
            password,

        });

    return { data, error };
}

export async function logout() {
    await supabase.auth.signOut();
}
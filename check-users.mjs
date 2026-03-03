import { createClient } from "@libsql/client";

const turso = createClient({
    url: "libsql://visit-checklist-ragilrrr.aws-ap-northeast-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxODU5MzEsImlkIjoiMDE5YzllM2EtNzAwMS03ZjFkLThiMGYtYjU5YzIzZTdmMTk5IiwicmlkIjoiNTU0Y2NlNWUtNDNhOC00NzhlLWE5NjQtMWFhMDEzYjZmZmY1In0.BxM9ZGJSaMXDcBjSPH3g2ivApAjb5wpR8IWdosO3f_yqQErcfZNlzMc7rQGjnPXO5zgXAURirwwN9KbMbadMDQ",
});

async function checkUsers() {
    try {
        const result = await turso.execute("SELECT * FROM users");
        console.log("Found " + result.rows.length + " users:");
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (error) {
        console.error("Error fetching users:", error);
    }
}

checkUsers();

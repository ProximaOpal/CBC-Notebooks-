import { describe, expect, it } from "vitest";
import { registerCredentialsAccount, verifyCredentialsAccount } from "@/lib/auth/accounts";
import { validateLogin, validateRegister } from "../src/assets/js/lib/auth-validate.js";
import { useTempDataDir } from "./helpers";

useTempDataDir();

describe("Domain C credentials overlay", () => {
  it("validates login and register the same way the overlay does", () => {
    expect(validateLogin("not-email", "password1")).toBe("Enter a valid email address");
    expect(validateLogin("ada@school.ke", "short")).toBe("Password must be at least 8 characters");
    expect(validateRegister("A", "ada@school.ke", "password1")).toBe("Name must be at least 2 characters");
    expect(validateRegister("Ada Lovelace", "ada@school.ke", "password1")).toBe("");
  });

  it("rejects a duplicate email on register", async () => {
    await registerCredentialsAccount({
      name: "Ada Lovelace",
      email: "ada@school.ke",
      password: "password1",
    });
    await expect(
      registerCredentialsAccount({
        name: "Ada Two",
        email: "ada@school.ke",
        password: "password1",
      })
    ).rejects.toMatchObject({ name: "DuplicateEmailError" });
  });

  it("stores bcrypt hashes, not SHA-256, and verifies login", async () => {
    const user = await registerCredentialsAccount({
      name: "Ada Lovelace",
      email: "ada@school.ke",
      password: "password1",
    });
    expect(user.passwordHash).toMatch(/^\$2[aby]?\$/);
    expect(user.passwordHash).not.toHaveLength(64);
    const ok = await verifyCredentialsAccount("ada@school.ke", "password1");
    expect(ok?.id).toBe(user.id);
    expect(await verifyCredentialsAccount("ada@school.ke", "wrongpass")).toBeNull();
  });
});

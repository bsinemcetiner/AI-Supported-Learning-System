"""
test_auth.py — Registration and Login Tests

Test Scenarios:
  - Successful registration (student & teacher)
  - Duplicate username / email
  - Login with wrong password
  - Login with non-existent user
  - Empty field validation
  - Signup without OTP verification
  - Email domain rules (role detection)
  - Token structure validation
"""

import pytest
import services.auth_manager as am
from tests.conftest import register_user, get_token, auth


# ══════════════════════════════════════════════════════════════════════════════
# SIGNUP TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestSignup:

    def test_teacher_signup_successful(self, client):
        """Teacher Kaya Oguz should be able to register successfully."""
        res = register_user(
            client,
            full_name="Kaya Oguz",
            username="kayaoguz_test",
            password="KayaOguz2024!",
            role="teacher",
            email="kaya.oguz.test@ieu.edu.tr",
        )
        assert res.status_code == 201
        assert "message" in res.json()

    def test_student_signup_successful(self, client):
        """Student Emiray Durmaz should be able to register successfully."""
        res = register_user(
            client,
            full_name="Emiray Durmaz",
            username="emiray_test",
            password="Emiray2024!",
            role="student",
            email="emiray.test@std.ieu.edu.tr",
        )
        assert res.status_code == 201

    def test_duplicate_username_rejected(self, client):
        """Yasemin cannot register again with the same username → 409."""
        register_user(client, "Yasemin Guler Kocar", "yasemin_dup",
                      "Yasemin2024!", "student", "yasemin.dup@std.ieu.edu.tr")
        # Second attempt with same username
        am._verified_emails.add("yasemin.dup2@std.ieu.edu.tr")
        res = client.post("/api/auth/signup", json={
            "full_name": "Yasemin Guler Kocar",
            "username": "yasemin_dup",
            "password": "Yasemin2024!",
            "role": "student",
            "email": "yasemin.dup2@std.ieu.edu.tr",
        })
        assert res.status_code == 409

    def test_signup_without_otp_rejected(self, client):
        """
        Signup attempt without adding email to _verified_emails should be rejected.
        """
        # Attempt signup WITHOUT adding to _verified_emails
        res = client.post("/api/auth/signup", json={
            "full_name": "Meltem Demir",
            "username": "meltem_nootp",
            "password": "Meltem2024!",
            "role": "student",
            "email": "meltem.nootp@std.ieu.edu.tr",
        })
        assert res.status_code == 400 or res.status_code == 409

    def test_empty_full_name_rejected(self, client):
        """Empty full_name should be rejected → 400."""
        am._verified_emails.add("empty@ieu.edu.tr")
        res = client.post("/api/auth/signup", json={
            "full_name": "",
            "username": "emptyname",
            "password": "Test1234!",
            "role": "teacher",
            "email": "empty@ieu.edu.tr",
        })
        assert res.status_code == 400

    def test_empty_username_rejected(self, client):
        """Empty username should be rejected → 400."""
        am._verified_emails.add("emptyuser@ieu.edu.tr")
        res = client.post("/api/auth/signup", json={
            "full_name": "Test User",
            "username": "",
            "password": "Test1234!",
            "role": "teacher",
            "email": "emptyuser@ieu.edu.tr",
        })
        assert res.status_code == 400

    def test_empty_password_rejected(self, client):
        """Empty password should be rejected → 400."""
        am._verified_emails.add("emptypass@ieu.edu.tr")
        res = client.post("/api/auth/signup", json={
            "full_name": "Test User",
            "username": "emptypassuser",
            "password": "",
            "role": "teacher",
            "email": "emptypass@ieu.edu.tr",
        })
        assert res.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# LOGIN TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestLogin:

    def test_teacher_login_successful(self, client):
        """Kaya Oguz should be able to login and receive a token."""
        register_user(client, "Kaya Oguz", "kayaoguz_login",
                      "KayaOguz2024!", "teacher", "kaya.login@ieu.edu.tr")
        res = client.post("/api/auth/login", json={
            "username": "kayaoguz_login",
            "password": "KayaOguz2024!",
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == "kayaoguz_login"
        assert data["user"]["role"] == "teacher"

    def test_student_login_successful(self, client):
        """Betul Sinem should be able to login successfully."""
        register_user(client, "Betul Sinem Cetiner", "betul_login",
                      "Betul2024!", "student", "betul.login@std.ieu.edu.tr")
        res = client.post("/api/auth/login", json={
            "username": "betul_login",
            "password": "Betul2024!",
        })
        assert res.status_code == 200
        assert res.json()["user"]["role"] == "student"

    def test_wrong_password_rejected(self, client):
        """Emiray should not be able to login with wrong password → 401."""
        register_user(client, "Emiray Durmaz", "emiray_wrongpw",
                      "Emiray2024!", "student", "emiray.wrongpw@std.ieu.edu.tr")
        res = client.post("/api/auth/login", json={
            "username": "emiray_wrongpw",
            "password": "WrongPassword!",
        })
        assert res.status_code == 401

    def test_nonexistent_user_rejected(self, client):
        """A user who never registered should not be able to login → 401."""
        res = client.post("/api/auth/login", json={
            "username": "nobody_xyz",
            "password": "Test1234!",
        })
        assert res.status_code == 401

    def test_token_content_correct(self, client):
        """Token should contain correct user information."""
        register_user(client, "Meltem Demir", "meltem_tok",
                      "Meltem2024!", "student", "meltem.tok@std.ieu.edu.tr")
        res = client.post("/api/auth/login", json={
            "username": "meltem_tok",
            "password": "Meltem2024!",
        })
        user = res.json()["user"]
        assert user["full_name"] == "Meltem Demir"
        assert user["username"] == "meltem_tok"
        assert user["role"] == "student"

    def test_valid_token_accesses_protected_endpoint(self, client):
        """A valid token should allow access to protected endpoints."""
        register_user(client, "Yasemin Guler Kocar", "yasemin_prot",
                      "Yasemin2024!", "student", "yasemin.prot@std.ieu.edu.tr")
        token = get_token(client, "yasemin_prot", "Yasemin2024!")
        res = client.get("/api/courses/", headers=auth(token))
        assert res.status_code == 200

    def test_no_token_protected_endpoint_rejected(self, client):
        """Accessing a protected endpoint without a token should be rejected → 401."""
        res = client.get("/api/courses/mine")
        assert res.status_code == 401

    def test_fake_token_rejected(self, client):
        """An invalid/fake token should be rejected → 401."""
        res = client.get("/api/courses/mine",
                         headers={"Authorization": "Bearer this_token_is_fake"})
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# EMAIL / ROLE RULE TESTS (unit — service layer)
# ══════════════════════════════════════════════════════════════════════════════

class TestEmailRoleRules:

    def test_std_ieu_edu_tr_is_student(self):
        from services.auth_manager import get_role_from_email
        assert get_role_from_email("emiray.durmaz@std.ieu.edu.tr") == "student"
        assert get_role_from_email("yasemin.guler@std.ieu.edu.tr") == "student"
        assert get_role_from_email("meltem.demir@std.ieu.edu.tr") == "student"
        assert get_role_from_email("betul.cetiner@std.ieu.edu.tr") == "student"

    def test_ieu_edu_tr_is_teacher(self):
        from services.auth_manager import get_role_from_email
        assert get_role_from_email("kaya.oguz@ieu.edu.tr") == "teacher"

    def test_invalid_domain_returns_none(self):
        from services.auth_manager import get_role_from_email
        assert get_role_from_email("someone@gmail.com") is None
        assert get_role_from_email("someone@hotmail.com") is None
        assert get_role_from_email("someone@ieu.com") is None

    def test_case_insensitive_email(self):
        from services.auth_manager import get_role_from_email
        assert get_role_from_email("EMIRAY@STD.IEU.EDU.TR") == "student"
        assert get_role_from_email("KAYA@IEU.EDU.TR") == "teacher"

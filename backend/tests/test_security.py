"""
test_security.py — Security Tests

Test Scenarios:

  Token Security:
  - Expired token rejected
  - Tampered/fake token rejected
  - Token with wrong signature rejected
  - Token with no username payload rejected
  - Role escalation: student acting as teacher → rejected
  - Role escalation: teacher acting as student → rejected (after chats.py fix)
  - Accessing endpoint with no token → 401
  - Accessing endpoint with malformed Authorization header → 401

  SQL Injection:
  - SQL injection in login username → safe (SQLAlchemy ORM protects)
  - SQL injection in login password → safe
  - SQL injection in course name → safe
  - SQL injection in signup username → safe
  - SQL injection in chat title → safe

  OTP / Email Security:
  - Invalid email domain rejected before OTP sent
  - Already registered email rejected before OTP sent
  - send_otp_email is called with correct address (mock)
  - Signup without OTP verification rejected
"""

import pytest
from datetime import timedelta
from unittest.mock import patch
from tests.conftest import register_user, get_token, auth


# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def emiray_token(client):
    """Student: Emiray Durmaz"""
    register_user(client, "Emiray Durmaz", "emiraydurmaz",
                  "Emiray2024!", "student", "emiray.durmaz@std.ieu.edu.tr")
    return get_token(client, "emiraydurmaz", "Emiray2024!")


@pytest.fixture
def yasemin_token(client):
    """Student: Yasemin Guler Kocar"""
    register_user(client, "Yasemin Guler Kocar", "yaseminguler",
                  "Yasemin2024!", "student", "yasemin.guler@std.ieu.edu.tr")
    return get_token(client, "yaseminguler", "Yasemin2024!")


@pytest.fixture
def meltem_token(client):
    """Student: Meltem Demir"""
    register_user(client, "Meltem Demir", "meltemdemir",
                  "Meltem2024!", "student", "meltem.demir@std.ieu.edu.tr")
    return get_token(client, "meltemdemir", "Meltem2024!")


@pytest.fixture
def betul_token(client):
    """Student: Betul Sinem Cetiner"""
    register_user(client, "Betul Sinem Cetiner", "betulcetin",
                  "Betul2024!", "student", "betul.cetiner@std.ieu.edu.tr")
    return get_token(client, "betulcetin", "Betul2024!")


@pytest.fixture
def kayaoguz_token(client):
    """Teacher: Kaya Oguz"""
    register_user(client, "Kaya Oguz", "kayaoguz",
                  "KayaOguz2024!", "teacher", "kaya.oguz@ieu.edu.tr")
    return get_token(client, "kayaoguz", "KayaOguz2024!")


# ══════════════════════════════════════════════════════════════════════════════
# TOKEN SECURITY TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestTokenSecurity:

    def test_expired_token_rejected(self, client):
        """A token that has already expired should be rejected → 401."""
        from core.auth import create_access_token
        expired_token = create_access_token(
            {"sub": "emiraydurmaz", "role": "student"},
            expires_delta=timedelta(seconds=-1)   # expired 1 second ago
        )
        res = client.get("/api/courses/",
                         headers={"Authorization": f"Bearer {expired_token}"})
        assert res.status_code == 401

    def test_completely_fake_token_rejected(self, client):
        """A completely made-up token string should be rejected → 401."""
        res = client.get("/api/courses/",
                         headers={"Authorization": "Bearer thisisafaketokenthatmakesnosense"})
        assert res.status_code == 401

    def test_wrong_signature_token_rejected(self, client):
        """A JWT token signed with a different secret key should be rejected → 401."""
        from jose import jwt
        fake_token = jwt.encode(
            {"sub": "emiraydurmaz", "role": "student"},
            "wrong_secret_key_that_is_not_real",
            algorithm="HS256"
        )
        res = client.get("/api/courses/",
                         headers={"Authorization": f"Bearer {fake_token}"})
        assert res.status_code == 401

    def test_token_without_username_rejected(self, client):
        """A token with no 'sub' field should be rejected → 401."""
        from core.auth import create_access_token
        token_no_sub = create_access_token({"role": "student"})  # no sub
        res = client.get("/api/courses/",
                         headers={"Authorization": f"Bearer {token_no_sub}"})
        assert res.status_code == 401

    def test_malformed_authorization_header_rejected(self, client):
        """Malformed Authorization header (no 'Bearer') → 401."""
        res = client.get("/api/courses/",
                         headers={"Authorization": "NotBearer sometoken"})
        assert res.status_code == 401

    def test_empty_authorization_header_rejected(self, client):
        """Empty Authorization header → 401."""
        res = client.get("/api/courses/mine",
                         headers={"Authorization": ""})
        assert res.status_code == 401

    def test_no_authorization_header_rejected(self, client):
        """No Authorization header at all → 401."""
        res = client.get("/api/courses/mine")
        assert res.status_code == 401

    def test_student_cannot_access_teacher_endpoint(self, client, emiray_token):
        """
        Role escalation: Student Emiray tries to access teacher-only endpoint.
        Even with a valid token, role check should block → 403.
        """
        res = client.post("/api/courses/",
                          json={"course_name": "Hacked Course"},
                          headers=auth(emiray_token))
        assert res.status_code == 403

    def test_teacher_cannot_access_student_endpoint(self, client, kayaoguz_token):
        """
        Role escalation: Teacher Kaya Oguz tries to access student-only endpoint.
        Even with a valid token, role check should block → 403.
        (Requires chats.py to use require_student — already fixed)
        """
        res = client.post("/api/chats/",
                          json={"title": "Unauthorized", "mode": "direct",
                                "tone": "Professional Tutor"},
                          headers=auth(kayaoguz_token))
        assert res.status_code == 403

    def test_forged_role_in_token_rejected(self, client):
        """
        Attacker manually creates a token claiming to be a teacher.
        Since the secret key is wrong, signature verification fails → 401.
        """
        from jose import jwt
        forged_token = jwt.encode(
            {"sub": "emiraydurmaz", "role": "teacher"},  # student forging teacher role
            "attackers_fake_secret",
            algorithm="HS256"
        )
        res = client.post("/api/courses/",
                          json={"course_name": "Forged Course"},
                          headers={"Authorization": f"Bearer {forged_token}"})
        assert res.status_code == 401

    def test_valid_student_token_accepted_on_student_endpoint(self, client, emiray_token):
        """Sanity check: valid student token should work on student endpoints."""
        res = client.get("/api/courses/", headers=auth(emiray_token))
        assert res.status_code == 200

    def test_valid_teacher_token_accepted_on_teacher_endpoint(self, client, kayaoguz_token):
        """Sanity check: valid teacher token should work on teacher endpoints."""
        res = client.get("/api/courses/mine", headers=auth(kayaoguz_token))
        assert res.status_code == 200

    def test_all_students_cannot_access_teacher_endpoints(
            self, client, emiray_token, yasemin_token, meltem_token, betul_token):
        """All 4 students should be blocked from teacher-only endpoints → 403."""
        for token, name in [
            (emiray_token, "Emiray"),
            (yasemin_token, "Yasemin"),
            (meltem_token, "Meltem"),
            (betul_token, "Betul"),
        ]:
            res = client.post("/api/courses/",
                              json={"course_name": f"{name} Hacked Course"},
                              headers=auth(token))
            assert res.status_code == 403, f"{name} should not access teacher endpoint"

    def test_all_students_cannot_upload_lesson(
            self, client, emiray_token, yasemin_token, meltem_token, betul_token):
        """All 4 students should be blocked from uploading lessons → 403."""
        import io
        fake_pdf = io.BytesIO(b"%PDF-1.4 fake")
        for token, name in [
            (emiray_token, "Emiray"),
            (yasemin_token, "Yasemin"),
            (meltem_token, "Meltem"),
            (betul_token, "Betul"),
        ]:
            fake_pdf.seek(0)
            res = client.post(
                "/api/lessons/upload",
                params={"course_id": "some_course", "week_title": "Week 1"},
                files={"file": ("lecture.pdf", fake_pdf, "application/pdf")},
                headers=auth(token),
            )
            assert res.status_code == 403, f"{name} should not upload lessons"

    def test_teacher_cannot_access_all_student_endpoints(self, client, kayaoguz_token):
        """Teacher Kaya Oguz should be blocked from all student-only endpoints → 403."""
        # Cannot create chat
        res = client.post("/api/chats/",
                          json={"title": "T", "mode": "direct", "tone": "Professional Tutor"},
                          headers=auth(kayaoguz_token))
        assert res.status_code == 403

        # Cannot list chats
        res = client.get("/api/chats/", headers=auth(kayaoguz_token))
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# SQL INJECTION TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestSQLInjection:
    """
    SQLAlchemy ORM automatically parameterizes queries, so SQL injection
    is largely prevented. These tests verify the app handles malicious
    input safely (no crash, no data leak, no 500 error).
    """

    def test_sql_injection_in_login_username(self, client):
        """SQL injection in username field should not crash the server."""
        res = client.post("/api/auth/login", json={
            "username": "' OR '1'='1'; --",
            "password": "anything"
        })
        assert res.status_code == 401   # rejected safely, no 500

    def test_sql_injection_in_login_password(self, client):
        """SQL injection in password field should be handled safely."""
        res = client.post("/api/auth/login", json={
            "username": "emiraydurmaz",
            "password": "' OR '1'='1"
        })
        assert res.status_code == 401   # rejected safely, no 500

    def test_sql_injection_in_signup_username(self, client):
        """SQL injection in signup username should not crash the server."""
        import services.auth_manager as am
        am._verified_emails.add("inject@ieu.edu.tr")
        res = client.post("/api/auth/signup", json={
            "full_name": "Injector",
            "username": "'; DROP TABLE users; --",
            "password": "Test1234!",
            "role": "teacher",
            "email": "inject@ieu.edu.tr"
        })
        # May succeed or fail validation, but must NOT crash
        assert res.status_code != 500

    def test_sql_injection_in_course_name(self, client, kayaoguz_token):
        """SQL injection in course name should be stored safely or rejected."""
        res = client.post("/api/courses/",
                          json={"course_name": "'; DROP TABLE courses; --"},
                          headers=auth(kayaoguz_token))
        # Must NOT crash — 201 (stored safely) or 4xx (rejected)
        assert res.status_code != 500

    def test_sql_injection_in_chat_title(self, client, emiray_token):
        """SQL injection in chat title should be handled safely."""
        res = client.post("/api/chats/",
                          json={"title": "'; DROP TABLE chats; --",
                                "mode": "direct", "tone": "Professional Tutor"},
                          headers=auth(emiray_token))
        assert res.status_code != 500

    def test_sql_injection_tables_still_exist_after_attempts(self, client, kayaoguz_token):
        """After all injection attempts, the database should still be intact."""
        # If tables were dropped, this would fail
        res = client.get("/api/courses/", headers=auth(kayaoguz_token))
        assert res.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# OTP / EMAIL SECURITY TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestOTPSecurity:

    def test_invalid_domain_rejected_before_otp_sent(self, client):
        """Gmail or other invalid domains should be rejected before OTP is sent."""
        res = client.post("/api/auth/send-otp",
                          json={"email": "attacker@gmail.com"})
        # 400 (email not verified) or 409 (conflict) — both mean rejected
        assert res.status_code in (400, 409)

    def test_invalid_domain_hotmail_rejected(self, client):
        """Hotmail domain should also be rejected."""
        res = client.post("/api/auth/send-otp",
                          json={"email": "attacker@hotmail.com"})
        # 400 (email not verified) or 409 (conflict) — both mean rejected
        assert res.status_code in (400, 409)

    def test_already_registered_email_rejected(self, client):
        """An email that is already registered should not receive a new OTP."""
        # Register Emiray first
        register_user(client, "Emiray Durmaz", "emiray_otp",
                      "Emiray2024!", "student", "emiray.otp@std.ieu.edu.tr")
        # Now try to send OTP to the same email again
        res = client.post("/api/auth/send-otp",
                          json={"email": "emiray.otp@std.ieu.edu.tr"})
        # 400 (email not verified) or 409 (conflict) — both mean rejected
        assert res.status_code in (400, 409)

    def test_otp_email_sent_to_correct_address(self, client):
        """send_otp_email should be called with the correct email address."""
        with patch("services.auth_manager.send_otp_email") as mock_mail:
            client.post("/api/auth/send-otp",
                        json={"email": "yasemin.test@std.ieu.edu.tr"})
            # Verify it was called and with correct address
            assert mock_mail.called
            call_args = mock_mail.call_args[0]
            assert call_args[0] == "yasemin.test@std.ieu.edu.tr"

    def test_otp_email_not_sent_for_invalid_domain(self, client):
        """send_otp_email should NOT be called for invalid domains."""
        with patch("services.auth_manager.send_otp_email") as mock_mail:
            client.post("/api/auth/send-otp",
                        json={"email": "hacker@gmail.com"})
            assert not mock_mail.called

    def test_signup_without_otp_verification_rejected(self, client):
        """Signup attempt without OTP verification should be rejected."""
        # Do NOT add to _verified_emails
        res = client.post("/api/auth/signup", json={
            "full_name": "Hacker",
            "username": "hacker_nootp",
            "password": "Hack1234!",
            "role": "student",
            "email": "hacker.nootp@std.ieu.edu.tr"
        })
        # 400 = email not verified, 409 = conflict — both mean rejected safely
        assert res.status_code in (400, 409)
        assert res.status_code != 201  # must NOT be accepted

"""
test_settings.py — Settings Tests

Test Scenarios:

  Get Profile (/settings/me):
  - Emiray can get her own profile
  - Kaya Oguz can get his own profile
  - Profile contains correct fields
  - No token rejected → 401

  Update Profile (/settings/profile):
  - Emiray can update her full name
  - Yasemin can update her full name
  - Kaya Oguz can update his full name
  - Empty full name rejected → 400
  - No token rejected → 401

  Change Password (/settings/password):
  - Emiray can change her password
  - Meltem can change her password
  - Wrong current password rejected → 400
  - New password too short rejected → 400 (min 6 chars)
  - After password change, old password no longer works
  - After password change, new password works
"""

import pytest
from tests.conftest import register_user, get_token, auth


# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def emiray_token(client):
    register_user(client, "Emiray Durmaz", "emiraydurmaz",
                  "Emiray2024!", "student", "emiray.durmaz@std.ieu.edu.tr")
    return get_token(client, "emiraydurmaz", "Emiray2024!")


@pytest.fixture
def yasemin_token(client):
    register_user(client, "Yasemin Guler Kocar", "yaseminguler",
                  "Yasemin2024!", "student", "yasemin.guler@std.ieu.edu.tr")
    return get_token(client, "yaseminguler", "Yasemin2024!")


@pytest.fixture
def meltem_token(client):
    register_user(client, "Meltem Demir", "meltemdemir",
                  "Meltem2024!", "student", "meltem.demir@std.ieu.edu.tr")
    return get_token(client, "meltemdemir", "Meltem2024!")


@pytest.fixture
def betul_token(client):
    register_user(client, "Betul Sinem Cetiner", "betulcetin",
                  "Betul2024!", "student", "betul.cetiner@std.ieu.edu.tr")
    return get_token(client, "betulcetin", "Betul2024!")


@pytest.fixture
def kayaoguz_token(client):
    register_user(client, "Kaya Oguz", "kayaoguz",
                  "KayaOguz2024!", "teacher", "kaya.oguz@ieu.edu.tr")
    return get_token(client, "kayaoguz", "KayaOguz2024!")


# ══════════════════════════════════════════════════════════════════════════════
# GET PROFILE
# ══════════════════════════════════════════════════════════════════════════════

class TestGetProfile:

    def test_emiray_can_get_her_profile(self, client, emiray_token):
        """Emiray should be able to get her own profile."""
        res = client.get("/api/settings/me", headers=auth(emiray_token))
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "emiraydurmaz"
        assert data["full_name"] == "Emiray Durmaz"
        assert data["role"] == "student"

    def test_yasemin_can_get_her_profile(self, client, yasemin_token):
        """Yasemin should be able to get her own profile."""
        res = client.get("/api/settings/me", headers=auth(yasemin_token))
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "yaseminguler"
        assert data["full_name"] == "Yasemin Guler Kocar"

    def test_meltem_can_get_her_profile(self, client, meltem_token):
        """Meltem should be able to get her own profile."""
        res = client.get("/api/settings/me", headers=auth(meltem_token))
        assert res.status_code == 200
        assert res.json()["username"] == "meltemdemir"

    def test_betul_can_get_her_profile(self, client, betul_token):
        """Betul should be able to get her own profile."""
        res = client.get("/api/settings/me", headers=auth(betul_token))
        assert res.status_code == 200
        assert res.json()["username"] == "betulcetin"

    def test_kayaoguz_can_get_his_profile(self, client, kayaoguz_token):
        """Kaya Oguz should be able to get his own profile."""
        res = client.get("/api/settings/me", headers=auth(kayaoguz_token))
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "kayaoguz"
        assert data["role"] == "teacher"

    def test_profile_contains_correct_fields(self, client, emiray_token):
        """Profile response should contain all expected fields."""
        res = client.get("/api/settings/me", headers=auth(emiray_token))
        data = res.json()
        assert "username" in data
        assert "full_name" in data
        assert "role" in data
        assert "email" in data

    def test_no_token_cannot_get_profile(self, client):
        """Getting profile without a token → 401."""
        res = client.get("/api/settings/me")
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# UPDATE PROFILE
# ══════════════════════════════════════════════════════════════════════════════

class TestUpdateProfile:

    def test_emiray_can_update_full_name(self, client, emiray_token):
        """Emiray should be able to update her full name."""
        res = client.patch("/api/settings/profile",
                           json={"full_name": "Emiray Durmaz Updated"},
                           headers=auth(emiray_token))
        assert res.status_code == 200

        # Verify change persisted
        profile = client.get("/api/settings/me", headers=auth(emiray_token)).json()
        assert profile["full_name"] == "Emiray Durmaz Updated"

    def test_yasemin_can_update_full_name(self, client, yasemin_token):
        """Yasemin should be able to update her full name."""
        res = client.patch("/api/settings/profile",
                           json={"full_name": "Yasemin G. Kocar"},
                           headers=auth(yasemin_token))
        assert res.status_code == 200

    def test_meltem_can_update_full_name(self, client, meltem_token):
        """Meltem should be able to update her full name."""
        res = client.patch("/api/settings/profile",
                           json={"full_name": "Meltem D."},
                           headers=auth(meltem_token))
        assert res.status_code == 200

    def test_betul_can_update_full_name(self, client, betul_token):
        """Betul should be able to update her full name."""
        res = client.patch("/api/settings/profile",
                           json={"full_name": "Betul S. Cetiner"},
                           headers=auth(betul_token))
        assert res.status_code == 200

    def test_kayaoguz_can_update_full_name(self, client, kayaoguz_token):
        """Kaya Oguz should be able to update his full name."""
        res = client.patch("/api/settings/profile",
                           json={"full_name": "Prof. Kaya Oguz"},
                           headers=auth(kayaoguz_token))
        assert res.status_code == 200

        profile = client.get("/api/settings/me", headers=auth(kayaoguz_token)).json()
        assert profile["full_name"] == "Prof. Kaya Oguz"

    def test_empty_full_name_rejected(self, client, emiray_token):
        """Empty full name should be rejected → 400."""
        res = client.patch("/api/settings/profile",
                           json={"full_name": ""},
                           headers=auth(emiray_token))
        assert res.status_code == 400

    def test_whitespace_only_name_rejected(self, client, yasemin_token):
        """Whitespace-only full name should be rejected → 400."""
        res = client.patch("/api/settings/profile",
                           json={"full_name": "   "},
                           headers=auth(yasemin_token))
        assert res.status_code == 400

    def test_no_token_cannot_update_profile(self, client):
        """Updating profile without a token → 401."""
        res = client.patch("/api/settings/profile",
                           json={"full_name": "Hacker"})
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# CHANGE PASSWORD
# ══════════════════════════════════════════════════════════════════════════════

class TestChangePassword:

    def test_emiray_can_change_password(self, client, emiray_token):
        """Emiray should be able to change her password."""
        res = client.patch("/api/settings/password",
                           json={"current_password": "Emiray2024!",
                                 "new_password": "NewEmiray2024!"},
                           headers=auth(emiray_token))
        assert res.status_code == 200

    def test_meltem_can_change_password(self, client, meltem_token):
        """Meltem should be able to change her password."""
        res = client.patch("/api/settings/password",
                           json={"current_password": "Meltem2024!",
                                 "new_password": "NewMeltem2024!"},
                           headers=auth(meltem_token))
        assert res.status_code == 200

    def test_kayaoguz_can_change_password(self, client, kayaoguz_token):
        """Kaya Oguz should be able to change his password."""
        res = client.patch("/api/settings/password",
                           json={"current_password": "KayaOguz2024!",
                                 "new_password": "NewKaya2024!"},
                           headers=auth(kayaoguz_token))
        assert res.status_code == 200

    def test_wrong_current_password_rejected(self, client, emiray_token):
        """Wrong current password should be rejected → 400."""
        res = client.patch("/api/settings/password",
                           json={"current_password": "WrongPassword!",
                                 "new_password": "NewPass2024!"},
                           headers=auth(emiray_token))
        assert res.status_code == 400

    def test_short_new_password_rejected(self, client, yasemin_token):
        """New password shorter than 6 characters should be rejected → 400."""
        res = client.patch("/api/settings/password",
                           json={"current_password": "Yasemin2024!",
                                 "new_password": "abc"},
                           headers=auth(yasemin_token))
        assert res.status_code == 400

    def test_old_password_no_longer_works_after_change(self, client):
        """After password change, old password should be rejected."""
        register_user(client, "Betul Sinem Cetiner", "betul_pwtest",
                      "OldPass2024!", "student", "betul.pwtest@std.ieu.edu.tr")
        token = get_token(client, "betul_pwtest", "OldPass2024!")

        # Change password
        client.patch("/api/settings/password",
                     json={"current_password": "OldPass2024!",
                           "new_password": "NewPass2024!"},
                     headers=auth(token))

        # Old password should no longer work
        res = client.post("/api/auth/login",
                          json={"username": "betul_pwtest",
                                "password": "OldPass2024!"})
        assert res.status_code == 401

    def test_new_password_works_after_change(self, client):
        """After password change, new password should work for login."""
        register_user(client, "Emiray Durmaz", "emiray_pwtest",
                      "OldPass2024!", "student", "emiray.pwtest@std.ieu.edu.tr")
        token = get_token(client, "emiray_pwtest", "OldPass2024!")

        # Change password
        client.patch("/api/settings/password",
                     json={"current_password": "OldPass2024!",
                           "new_password": "NewPass2024!"},
                     headers=auth(token))

        # New password should work
        res = client.post("/api/auth/login",
                          json={"username": "emiray_pwtest",
                                "password": "NewPass2024!"})
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_no_token_cannot_change_password(self, client):
        """Changing password without a token → 401."""
        res = client.patch("/api/settings/password",
                           json={"current_password": "Old2024!",
                                 "new_password": "New2024!"})
        assert res.status_code == 401

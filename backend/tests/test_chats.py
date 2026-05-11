"""
test_chats.py — Chat Tests

Test Scenarios:

  Chat Creation:
  - Emiray can create a chat
  - Chat with starter message is created correctly
  - No token cannot create chat
  - Chat is listed after creation

  Chat History:
  - User can list their own chats
  - User cannot see other user's chats
  - Empty chat list returns empty dict

  Send Message:
  - Emiray can send a message (stream=False, AI mocked)
  - Message appears in chat history
  - Cannot send message to someone else's chat
  - Cannot send message to nonexistent chat
  - Empty message rejected

  Chat Operations:
  - Rename a chat
  - Cannot rename with empty title
  - Delete a chat
  - Cannot delete someone else's chat
  - Update chat settings (mode, tone)

  Regenerate:
  - Cannot regenerate with no messages
"""

import pytest
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


def create_chat(client, token: str, title: str = "Test Chat",
                starter: str = None, mode: str = "direct",
                tone: str = "Professional Tutor") -> str:
    """Create a chat and return chat_id."""
    body = {"title": title, "mode": mode, "tone": tone}
    if starter:
        body["starter_message"] = starter
    res = client.post("/api/chats/", json=body, headers=auth(token))
    assert res.status_code == 201, f"Chat creation failed: {res.json()}"
    return res.json()["chat_id"]


# ══════════════════════════════════════════════════════════════════════════════
# CHAT CREATION
# ══════════════════════════════════════════════════════════════════════════════

class TestChatCreation:

    def test_emiray_can_create_chat(self, client, emiray_token):
        """Emiray Durmaz should be able to create a new chat."""
        res = client.post("/api/chats/",
                          json={"title": "My Study Chat", "mode": "direct",
                                "tone": "Professional Tutor"},
                          headers=auth(emiray_token))
        assert res.status_code == 201
        assert "chat_id" in res.json()

    def test_chat_with_starter_message(self, client, yasemin_token):
        """Yasemin creating a chat with a starter message should work."""
        res = client.post("/api/chats/",
                          json={"title": "OS Study", "mode": "direct",
                                "tone": "Friendly Mentor",
                                "starter_message": "Welcome to the lesson!"},
                          headers=auth(yasemin_token))
        assert res.status_code == 201
        chat_id = res.json()["chat_id"]

        # Starter message should appear in chat history
        chats = client.get("/api/chats/", headers=auth(yasemin_token)).json()
        messages = chats[chat_id]["messages"]
        assert len(messages) == 1
        assert messages[0]["content"] == "Welcome to the lesson!"
        assert messages[0]["role"] == "assistant"

    def test_no_token_cannot_create_chat(self, client):
        """Creating a chat without a token should be rejected → 401."""
        res = client.post("/api/chats/",
                          json={"title": "Unauthorized", "mode": "direct",
                                "tone": "Professional Tutor"})
        assert res.status_code == 401

    def test_teacher_cannot_create_chat(self, client, kayaoguz_token):
        """
        BUG-001: Teacher Kaya Oguz should NOT be able to create a student chat.
        Chat is a student-only feature.
        Currently FAILS because chats.py uses get_current_user instead of require_student.
        FIX: Replace Depends(get_current_user) with Depends(require_student) in chats.py.
        """
        res = client.post("/api/chats/",
                          json={"title": "Teacher Chat", "mode": "direct",
                                "tone": "Professional Tutor"},
                          headers=auth(kayaoguz_token))
        assert res.status_code == 403  # Currently returns 201 → BUG

    def test_chat_with_different_tones(self, client, meltem_token):
        """Meltem should be able to create chats with different tones."""
        for tone in ["Professional Tutor", "Friendly Mentor", "Simplified Explainer"]:
            res = client.post("/api/chats/",
                              json={"title": f"Chat - {tone}", "mode": "direct",
                                    "tone": tone},
                              headers=auth(meltem_token))
            assert res.status_code == 201


# ══════════════════════════════════════════════════════════════════════════════
# CHAT HISTORY / LISTING
# ══════════════════════════════════════════════════════════════════════════════

class TestChatHistory:

    def test_emiray_can_list_her_chats(self, client, emiray_token):
        """Emiray should be able to list all her chats."""
        create_chat(client, emiray_token, "Chat 1")
        create_chat(client, emiray_token, "Chat 2")
        res = client.get("/api/chats/", headers=auth(emiray_token))
        assert res.status_code == 200
        assert len(res.json()) >= 2

    def test_users_cannot_see_each_others_chats(self, client, emiray_token, yasemin_token):
        """Emiray's chats should not appear in Yasemin's chat list."""
        create_chat(client, emiray_token, "Emiray Private Chat")
        res = client.get("/api/chats/", headers=auth(yasemin_token))
        chats = res.json()
        titles = [c["title"] for c in chats.values()]
        assert "Emiray Private Chat" not in titles

    def test_empty_chat_list_returns_empty_dict(self, client, betul_token):
        """Betul with no chats should get an empty dict."""
        res = client.get("/api/chats/", headers=auth(betul_token))
        assert res.status_code == 200
        assert res.json() == {}

    def test_no_token_cannot_list_chats(self, client):
        """Listing chats without a token → 401."""
        res = client.get("/api/chats/")
        assert res.status_code == 401

    def test_chat_contains_correct_fields(self, client, meltem_token):
        """Each chat in the list should contain expected fields."""
        create_chat(client, meltem_token, "Field Test Chat")
        res = client.get("/api/chats/", headers=auth(meltem_token))
        chat = list(res.json().values())[0]
        assert "id" in chat
        assert "title" in chat
        assert "mode" in chat
        assert "tone" in chat
        assert "messages" in chat
        assert "created_at" in chat


# ══════════════════════════════════════════════════════════════════════════════
# SEND MESSAGE
# ══════════════════════════════════════════════════════════════════════════════

class TestSendMessage:

    def test_emiray_can_send_message(self, client, emiray_token):
        """Emiray should be able to send a message and get an AI reply (mocked)."""
        chat_id = create_chat(client, emiray_token, "Study Session")

        with patch("api.routes.chats.ai_engine.generate_ai_response",
                   return_value="Processes are programs in execution."), \
             patch("api.routes.chats._get_chat_context",
                   return_value="A process is a running program in the OS."):

            res = client.post(f"/api/chats/{chat_id}/messages",
                              json={"content": "What is a process?", "stream": False},
                              headers=auth(emiray_token))

        assert res.status_code == 200
        data = res.json()
        assert data["role"] == "assistant"
        assert len(data["content"]) > 0

    def test_message_appears_in_chat_history(self, client, emiray_token):
        """After sending a message, it should appear in the chat history."""
        chat_id = create_chat(client, emiray_token, "History Test")

        with patch("api.routes.chats.ai_engine.generate_ai_response",
                   return_value="Memory is where programs run."), \
             patch("api.routes.chats._get_chat_context",
                   return_value="Memory management context here."):
            client.post(f"/api/chats/{chat_id}/messages",
                        json={"content": "What is memory?", "stream": False},
                        headers=auth(emiray_token))

        chats = client.get("/api/chats/", headers=auth(emiray_token)).json()
        messages = chats[chat_id]["messages"]
        contents = [m["content"] for m in messages]
        assert "What is memory?" in contents

    def test_cannot_send_to_nonexistent_chat(self, client, yasemin_token):
        """Sending a message to a nonexistent chat → 404."""
        res = client.post("/api/chats/99999/messages",
                          json={"content": "Hello?", "stream": False},
                          headers=auth(yasemin_token))
        assert res.status_code == 404

    def test_cannot_send_to_another_users_chat(self, client, emiray_token, yasemin_token):
        """Yasemin should not be able to send messages to Emiray's chat → 404."""
        chat_id = create_chat(client, emiray_token, "Emiray Chat")
        res = client.post(f"/api/chats/{chat_id}/messages",
                          json={"content": "Intruding!", "stream": False},
                          headers=auth(yasemin_token))
        assert res.status_code == 404

    def test_no_token_cannot_send_message(self, client, emiray_token):
        """Sending a message without a token → 401."""
        chat_id = create_chat(client, emiray_token, "Token Test")
        res = client.post(f"/api/chats/{chat_id}/messages",
                          json={"content": "Hello", "stream": False})
        assert res.status_code == 401

    def test_multiple_students_send_messages(self, client, emiray_token,
                                             yasemin_token, meltem_token):
        """Emiray, Yasemin and Meltem can all send messages in their own chats."""
        for token, question in [
            (emiray_token, "What is scheduling?"),
            (yasemin_token, "Explain deadlock."),
            (meltem_token, "What is paging?"),
        ]:
            chat_id = create_chat(client, token, "Study")
            with patch("api.routes.chats.ai_engine.generate_ai_response",
                       return_value="Great question!"), \
                 patch("api.routes.chats._get_chat_context",
                       return_value="Relevant OS content here."):
                res = client.post(f"/api/chats/{chat_id}/messages",
                                  json={"content": question, "stream": False},
                                  headers=auth(token))
            assert res.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# RENAME / DELETE / SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

class TestChatOperations:

    def test_emiray_can_rename_chat(self, client, emiray_token):
        """Emiray should be able to rename her chat."""
        chat_id = create_chat(client, emiray_token, "Old Name")
        res = client.patch(f"/api/chats/{chat_id}/rename",
                           json={"title": "New Name"},
                           headers=auth(emiray_token))
        assert res.status_code == 200

        chats = client.get("/api/chats/", headers=auth(emiray_token)).json()
        assert chats[chat_id]["title"] == "New Name"

    def test_rename_with_empty_title_rejected(self, client, yasemin_token):
        """Renaming a chat with an empty title → 400."""
        chat_id = create_chat(client, yasemin_token, "Yasemin Chat")
        res = client.patch(f"/api/chats/{chat_id}/rename",
                           json={"title": ""},
                           headers=auth(yasemin_token))
        assert res.status_code == 400

    def test_cannot_rename_another_users_chat(self, client, emiray_token, meltem_token):
        """Meltem should not be able to rename Emiray's chat → 404."""
        chat_id = create_chat(client, emiray_token, "Emiray Chat")
        res = client.patch(f"/api/chats/{chat_id}/rename",
                           json={"title": "Hacked"},
                           headers=auth(meltem_token))
        assert res.status_code == 404

    def test_betul_can_delete_chat(self, client, betul_token):
        """Betul should be able to delete her chat."""
        chat_id = create_chat(client, betul_token, "To Delete")
        res = client.delete(f"/api/chats/{chat_id}",
                            headers=auth(betul_token))
        assert res.status_code == 200

        # Chat should no longer appear in list
        chats = client.get("/api/chats/", headers=auth(betul_token)).json()
        assert chat_id not in chats

    def test_cannot_delete_another_users_chat(self, client, emiray_token, betul_token):
        """Betul should not be able to delete Emiray's chat → 404."""
        chat_id = create_chat(client, emiray_token, "Emiray Chat")
        res = client.delete(f"/api/chats/{chat_id}",
                            headers=auth(betul_token))
        assert res.status_code == 404

    def test_delete_nonexistent_chat(self, client, emiray_token):
        """Deleting a nonexistent chat → 404."""
        res = client.delete("/api/chats/99999",
                            headers=auth(emiray_token))
        assert res.status_code == 404

    def test_update_chat_settings(self, client, meltem_token):
        """Meltem should be able to update mode and tone of her chat."""
        chat_id = create_chat(client, meltem_token, "Settings Test")
        res = client.patch(f"/api/chats/{chat_id}/settings",
                           json={"mode": "rag", "tone": "Friendly Mentor"},
                           headers=auth(meltem_token))
        assert res.status_code == 200

    def test_update_only_tone(self, client, yasemin_token):
        """Yasemin should be able to update only the tone."""
        chat_id = create_chat(client, yasemin_token, "Tone Test")
        res = client.patch(f"/api/chats/{chat_id}/settings",
                           json={"tone": "Simplified Explainer"},
                           headers=auth(yasemin_token))
        assert res.status_code == 200

    def test_cannot_update_another_users_chat_settings(
            self, client, emiray_token, yasemin_token):
        """Yasemin should not be able to update Emiray's chat settings → 404."""
        chat_id = create_chat(client, emiray_token, "Emiray Chat")
        res = client.patch(f"/api/chats/{chat_id}/settings",
                           json={"tone": "Friendly Mentor"},
                           headers=auth(yasemin_token))
        assert res.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# REGENERATE
# ══════════════════════════════════════════════════════════════════════════════

class TestRegenerate:

    def test_cannot_regenerate_empty_chat(self, client, emiray_token):
        """Regenerating in a chat with no messages → 400."""
        chat_id = create_chat(client, emiray_token, "Empty Chat")
        res = client.post(f"/api/chats/{chat_id}/regenerate",
                          headers=auth(emiray_token))
        assert res.status_code == 400

    def test_cannot_regenerate_another_users_chat(self, client, emiray_token, meltem_token):
        """Meltem should not be able to regenerate in Emiray's chat → 404."""
        chat_id = create_chat(client, emiray_token, "Emiray Chat")
        res = client.post(f"/api/chats/{chat_id}/regenerate",
                          headers=auth(meltem_token))
        assert res.status_code == 404

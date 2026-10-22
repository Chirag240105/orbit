from app.storage import USERS


def find_user_by_email(email: str) -> dict | None:
    return next((user for user in USERS.values() if user["email"].casefold() == email.casefold()), None)

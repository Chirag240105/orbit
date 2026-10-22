from app.repositories.users import find_user_by_email


def authenticate(email: str, password: str) -> dict | None:
    user = find_user_by_email(email)
    if user is None or user["password"] != password:
        return None
    return user

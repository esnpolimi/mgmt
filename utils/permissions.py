def user_is_board(user):
    return user.groups.filter(name="Board").exists()


def profile_email_verified(profile):
    return bool(profile and profile.enabled and profile.email_is_verified)

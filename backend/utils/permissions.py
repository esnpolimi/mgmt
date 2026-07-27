def user_is_board(user):
    return user.groups.filter(name="Board").exists()

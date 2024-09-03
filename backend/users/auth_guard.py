from rest_framework.response import Response

def is_logged(user):
    if user is None or user.is_anonymous or not user.is_authenticated:
        return False
    return True

def login_required(function):
    def wrapper(request, *args, **kw):
        if not is_logged(request.user):
            return Response(status=401)
        else:
            return function(request,*args,**kw)
        
    return wrapper
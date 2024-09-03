from users.models import User
from users.serializers import UserSerializer, LoginSerializer
from users.auth_guard import is_logged, login_required
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth import authenticate, login

@api_view(['POST'])
def log_in(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        user = authenticate(username=username, password=password)

        if user is not None:
            login(request,user)
            return Response(status=200)

        return Response({'detail': 'Invalid credentials'}, status=401)
    
    return Response(serializer.errors, status=400)

@api_view(['GET', 'POST'])
def user_list(request):
    if request.method == 'GET':
        if not is_logged(request.user):
            return Response(status=401)
    
        users = User.objects.all()
        serializer = UserSerializer(users,many=True)
        return Response(serializer.data)
    
    if request.method == 'POST':
        data = request.data
        serializer = UserSerializer(data=data)
        
        if serializer.is_valid():
            serializer.save()
            return Response(status=201)
        return Response(serializer.errors,status=400)
    
    
@api_view(['GET','PATCH','DELETE'])
@login_required
def user_detail(request,pk):
    
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response(status=404)
    
    if request.method == 'GET':
        serializer = UserSerializer(user)
        return Response(serializer.data)
    
    if request.method == 'PATCH':
        data = request.data
        serializer = UserSerializer(user, data=data,partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
    if request.method == 'DELETE':
        if request.user.has_perm('backend.delete_user'):
            user.delete()
            return Response(status=204)
        return Response(status=401)

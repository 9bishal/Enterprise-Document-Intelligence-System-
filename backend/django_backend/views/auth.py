import random
import string
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

# DRF Imports
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

# Custom imports
from django_backend.models import UserProfile, UserInvitation, PasswordResetOTP

@api_view(['POST'])
@permission_classes([AllowAny])
def auth_signup(request):
    username = request.data.get("username")
    password = request.data.get("password")
    email = request.data.get("email", "")
    otp = request.data.get("otp", "")

    if not username or not password:
        return Response({"detail": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({"detail": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

    # First-user bootstrap: allow the first user to self-register as Admin
    if User.objects.count() == 0:
        user = User.objects.create_user(username=username, password=password, email=email)
        profile = UserProfile.objects.create(user=user, role='Admin', department='General')
        refresh = RefreshToken.for_user(user)
        return Response({
            "username": user.username,
            "role": "Admin",
            "department": "General",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "detail": "First user registered as Admin successfully."
        }, status=status.HTTP_201_CREATED)

    # All subsequent users must have a valid OTP invitation
    if not email or not otp:
        return Response({"detail": "Email and OTP code are required for registration. Contact your administrator for an invitation."}, status=status.HTTP_400_BAD_REQUEST)

    # Validate invitation
    invitation = UserInvitation.objects.filter(
        email=email, otp=otp, is_verified=False
    ).first()

    if not invitation:
        return Response({"detail": "Invalid email or OTP code. Please check and try again."}, status=status.HTTP_400_BAD_REQUEST)

    if invitation.expires_at < timezone.now():
        return Response({"detail": "OTP has expired. Please request a new invitation from your administrator."}, status=status.HTTP_400_BAD_REQUEST)

    # Create user with pre-assigned role and department from invitation
    user = User.objects.create_user(username=username, password=password, email=email)
    profile = UserProfile.objects.create(
        user=user,
        role=invitation.role,
        department=invitation.department
    )

    # Mark invitation as verified
    invitation.is_verified = True
    invitation.save()

    refresh = RefreshToken.for_user(user)
    return Response({
        "username": user.username,
        "role": invitation.role,
        "department": invitation.department,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "detail": "Signup successful."
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login(request):
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response({"detail": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(username=username, password=password)
    if user is not None:
        profile, created = UserProfile.objects.get_or_create(user=user, defaults={'role': 'Viewer', 'department': 'General'})
        refresh = RefreshToken.for_user(user)
        return Response({
            "username": user.username,
            "role": profile.role,
            "department": profile.department,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "detail": "Login successful."
        })
    else:
        return Response({"detail": "Invalid username or password."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auth_logout(request):
    return Response({"detail": "Logout successful."})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_me(request):
    profile, created = UserProfile.objects.get_or_create(user=request.user, defaults={'role': 'Viewer', 'department': 'General'})
    return Response({
        "username": request.user.username,
        "role": profile.role,
        "department": profile.department,
        "authenticated": True
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def auth_forgot_password(request):
    email = request.data.get("email")
    if not email:
        return Response({"detail": "Email is required."}, status=400)
        
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({"detail": "No registered user found with this email."}, status=404)
        
    otp = ''.join(random.choices(string.digits, k=6))
    
    PasswordResetOTP.objects.filter(email=email).delete()
    PasswordResetOTP.objects.create(email=email, otp=otp)
    
    print(f"\n{'='*50}\nPASSWORD RESET OTP FOR {email}: {otp}\n{'='*50}\n")
    
    return Response({"message": "Password reset OTP sent to email."})

@api_view(['POST'])
@permission_classes([AllowAny])
def auth_reset_password(request):
    email = request.data.get("email")
    otp = request.data.get("otp")
    new_password = request.data.get("new_password")
    
    if not email or not otp or not new_password:
        return Response({"detail": "Email, OTP, and new password are required."}, status=400)
        
    try:
        reset_entry = PasswordResetOTP.objects.get(email=email, otp=otp)
    except PasswordResetOTP.DoesNotExist:
        return Response({"detail": "Invalid or expired OTP."}, status=400)
        
    try:
        user = User.objects.get(email=email)
        user.set_password(new_password)
        user.save()
        reset_entry.delete()
        return Response({"message": "Password reset successfully."})
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=404)

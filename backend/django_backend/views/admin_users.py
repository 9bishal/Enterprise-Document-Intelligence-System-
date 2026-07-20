import random
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

# DRF Imports
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

# Custom imports
from django_backend.models import UserProfile, UserInvitation
from django_backend.permissions import IsAdminUser

# --- Admin Invite Endpoint ---

@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_invite(request):
    """Send an OTP invitation email to a new employee."""
    email = request.data.get("email", "").strip()
    role = request.data.get("role", "Viewer")
    department = request.data.get("department", "General")

    if not email:
        return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Validate role and department
    valid_roles = ['Viewer', 'Editor', 'Admin']
    valid_departments = ['HR', 'Legal', 'Finance', 'Technical', 'General']

    if role not in valid_roles:
        return Response({"detail": f"Invalid role. Must be one of: {', '.join(valid_roles)}"}, status=status.HTTP_400_BAD_REQUEST)
    if department not in valid_departments:
        return Response({"detail": f"Invalid department. Must be one of: {', '.join(valid_departments)}"}, status=status.HTTP_400_BAD_REQUEST)

    # Check if user with this email already exists
    if User.objects.filter(email=email).exists():
        return Response({"detail": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    expires_at = timezone.now() + timedelta(minutes=15)

    # Create or update invitation (re-invite invalidates previous OTP)
    invitation, created = UserInvitation.objects.update_or_create(
        email=email,
        defaults={
            "otp": otp,
            "role": role,
            "department": department,
            "expires_at": expires_at,
            "is_verified": False,
        }
    )

    # Send email via Django SMTP
    try:
        from django.core.mail import send_mail
        subject = "Intradoc AI — Your Corporate Workspace Invitation"
        message = (
            f"Hello,\n\n"
            f"You have been invited to join Intradoc AI as a {role} in the {department} department.\n\n"
            f"Your one-time registration code is:\n\n"
            f"    {otp}\n\n"
            f"This code expires in 15 minutes.\n\n"
            f"To complete your registration:\n"
            f"1. Go to http://localhost:5173\n"
            f"2. Click 'Register now'\n"
            f"3. Enter your username, password, this email, and the code above\n\n"
            f"— Intradoc AI Administration"
        )
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return Response({
            "detail": f"Invitation sent successfully to {email}.",
            "role": role,
            "department": department
        })
    except Exception as e:
        # Even if email fails, the OTP is saved so admin can relay it manually
        print(f"SMTP email send error: {str(e)}")
        return Response({
            "detail": f"Invitation created but email delivery failed. OTP: {otp}. Error: {str(e)}",
            "otp": otp,
            "role": role,
            "department": department
        }, status=status.HTTP_207_MULTI_STATUS)

# --- Admin User Management Endpoints ---

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_users_list(request):
    """Get all users with their profiles for the corporate roster."""
    users_data = []
    for u in User.objects.all().order_by('-date_joined'):
        profile, _ = UserProfile.objects.get_or_create(user=u, defaults={'role': 'Viewer', 'department': 'General'})
        users_data.append({
            "id": u.id,
            "username": u.username,
            "email": u.email or "",
            "role": profile.role,
            "department": profile.department,
            "date_joined": u.date_joined.isoformat()
        })
    return Response(users_data)

@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_update_user(request, user_id):
    """Update a user's role and/or department."""
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    profile, _ = UserProfile.objects.get_or_create(user=target_user, defaults={'role': 'Viewer', 'department': 'General'})

    # Prevent admin from demoting themselves
    if target_user.id == request.user.id:
        new_role = request.data.get("role", profile.role)
        if new_role != 'Admin':
            return Response({"detail": "You cannot demote yourself. Ask another admin to change your role."}, status=status.HTTP_400_BAD_REQUEST)

    new_role = request.data.get("role", None)
    new_department = request.data.get("department", None)

    if new_role:
        valid_roles = ['Viewer', 'Editor', 'Admin']
        if new_role not in valid_roles:
            return Response({"detail": f"Invalid role. Must be one of: {', '.join(valid_roles)}"}, status=status.HTTP_400_BAD_REQUEST)
        profile.role = new_role

    if new_department:
        valid_departments = ['HR', 'Legal', 'Finance', 'Technical', 'General']
        if new_department not in valid_departments:
            return Response({"detail": f"Invalid department. Must be one of: {', '.join(valid_departments)}"}, status=status.HTTP_400_BAD_REQUEST)
        profile.department = new_department

    profile.save()

    return Response({
        "detail": f"User '{target_user.username}' updated successfully.",
        "id": target_user.id,
        "username": target_user.username,
        "role": profile.role,
        "department": profile.department
    })

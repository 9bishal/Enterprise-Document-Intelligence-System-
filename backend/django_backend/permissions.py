from rest_framework import permissions

class IsViewerOrAbove(permissions.BasePermission):
    """
    Allows access to any authenticated user with any role.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

class IsEditorOrAbove(permissions.BasePermission):
    """
    Allows access only to users with Editor or Admin roles.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        
        # Safe fallback: check if user profile exists
        try:
            role = request.user.profile.role
            return role in ['Editor', 'Admin']
        except Exception:
            return False

class IsAdminUser(permissions.BasePermission):
    """
    Allows access only to users with the Admin role.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        
        try:
            role = request.user.profile.role
            return role == 'Admin'
        except Exception:
            return False

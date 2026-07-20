import json
from django.db import models
from django.contrib.auth.models import User

DEPT_CHOICES = (
    ('HR', 'HR'),
    ('Legal', 'Legal'),
    ('Finance', 'Finance'),
    ('Technical', 'Technical'),
    ('General', 'General'),
)

class UserProfile(models.Model):
    ROLE_CHOICES = (
        ('Viewer', 'Viewer'),
        ('Editor', 'Editor'),
        ('Admin', 'Admin'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Viewer')
    department = models.CharField(max_length=20, choices=DEPT_CHOICES, default='General')

    def __str__(self):
        return f"{self.user.username} - {self.role} ({self.department})"

class Document(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="documents")
    filename = models.CharField(max_length=255)
    path = models.CharField(max_length=512)
    file_size = models.IntegerField()
    chunk_count = models.IntegerField(default=0)
    status = models.CharField(max_length=50, default="ingesting") # ingesting, indexed, error
    error_message = models.TextField(null=True, blank=True)
    classification = models.CharField(max_length=100, default="General")
    risk_status = models.CharField(max_length=50, default="Clean") # Clean, Risk Detected
    risk_details = models.TextField(null=True, blank=True)
    department = models.CharField(max_length=20, choices=DEPT_CHOICES, default='General')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.filename} ({self.status}) - {self.department}"

class UserInvitation(models.Model):
    ROLE_CHOICES = (
        ('Viewer', 'Viewer'),
        ('Editor', 'Editor'),
        ('Admin', 'Admin'),
    )
    email = models.EmailField(unique=True)
    otp = models.CharField(max_length=6)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='Viewer')
    department = models.CharField(max_length=20, choices=DEPT_CHOICES, default='General')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.email} - OTP: {self.otp} ({self.role} in {self.department})"

class PasswordResetOTP(models.Model):
    email = models.EmailField(unique=True)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Reset OTP for {self.email}"

class LLMConfig(models.Model):
    enforce_globally = models.BooleanField(default=False)
    provider = models.CharField(max_length=50, default='gemini')
    model = models.CharField(max_length=100, default='gemini-1.5-flash')
    temperature = models.FloatField(default=0.3)
    k = models.IntegerField(default=4)
    groq_api_key = models.CharField(max_length=255, blank=True)
    gemini_api_key = models.CharField(max_length=255, blank=True)
    openai_api_key = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"Global LLM Config (Enforced: {self.enforce_globally})"


class ChatSession(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.user.username}"

class ChatMessage(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=50) # 'user' or 'assistant'
    content = models.TextField()
    sources = models.TextField(null=True, blank=True) # JSON array of sources
    steps = models.TextField(null=True, blank=True) # JSON array of steps
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.role} in {self.session.id}"

    def get_sources_list(self):
        if self.sources:
            try:
                return json.loads(self.sources)
            except Exception:
                return []
        return []

    def get_steps_list(self):
        if self.steps:
            try:
                return json.loads(self.steps)
            except Exception:
                return []
        return []

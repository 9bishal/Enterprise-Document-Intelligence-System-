from rest_framework import serializers
from django.contrib.auth.models import User
from django_backend.models import UserProfile, Document, ChatSession, ChatMessage

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('role',)

class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='profile.role', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'role')

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = (
            'id', 
            'filename', 
            'path', 
            'file_size', 
            'chunk_count', 
            'status', 
            'error_message', 
            'classification', 
            'risk_status', 
            'risk_details', 
            'created_at'
        )
        read_only_fields = ('id', 'chunk_count', 'status', 'error_message', 'classification', 'risk_status', 'risk_details', 'created_at')

class ChatSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSession
        fields = ('id', 'name', 'created_at')
        read_only_fields = ('id', 'created_at')

class ChatMessageSerializer(serializers.ModelSerializer):
    sources = serializers.SerializerMethodField()
    steps = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ('id', 'session_id', 'role', 'content', 'sources', 'steps', 'created_at')
        read_only_fields = ('id', 'created_at')

    def get_sources(self, obj):
        return obj.get_sources_list()

    def get_steps(self, obj):
        return obj.get_steps_list()

from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.validators import RegexValidator
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.utils.encoding import smart_str, DjangoUnicodeDecodeError
from django.utils.http import urlsafe_base64_decode
from .models import Streak, UserProfile

User = get_user_model()

USERNAME_REGEX = r'^[\w.@+-]{3,}$'
PASSWORD_REGEX = r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$'


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        min_length=3,
        trim_whitespace=True,
        allow_blank=False,
        validators=[
            RegexValidator(
                regex=USERNAME_REGEX,
                message=(
                    "Username must be ≥3 chars and can only contain "
                    "letters, numbers, and @/./+/-/_ (no spaces)."
                )
            ),
            UniqueValidator(
                queryset=User.objects.all(),
                message="That username is already taken."
            )
        ],
        error_messages={
            'blank': 'Username cannot be blank or just spaces.',
            'min_length': 'Username must be at least 3 characters.',
            'required': 'Username is required.',
        }
    )

    email = serializers.EmailField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="That email is already registered."
            )
        ],
        error_messages={'required': 'Email is required.'}
    )

    password = serializers.CharField(
        write_only=True,
        validators=[
            RegexValidator(
                regex=PASSWORD_REGEX,
                message='Password must be ≥8 chars, include a letter, number, and special char.'
            )
        ],
        error_messages={'required': 'Password is required.'}
    )

    confirm_password = serializers.CharField(
        write_only=True,
        error_messages={'required': 'Confirm password is required.'}
    )

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'confirm_password')

    def validate(self, data):
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError('Passwords do not match.')
        if data.get('username') == data.get('email'):
            raise serializers.ValidationError('Username cannot be the same as email.')
        if data.get('username') == data.get('password'):
            raise serializers.ValidationError('Username cannot be the same as password.')
        if data.get('email') == data.get('password'):
            raise serializers.ValidationError('Email cannot be the same as password.')
        if data.get('username') == data.get('confirm_password'):
            raise serializers.ValidationError('Username cannot be the same as confirm password.')
        if data.get('email') == data.get('confirm_password'):
            raise serializers.ValidationError('Email cannot be the same as confirm password.')
        if User.objects.filter(username=data.get('username')).exists():
            raise serializers.ValidationError('That username is already taken.')
        if User.objects.filter(email__iexact=data.get('email')).exists():
            raise serializers.ValidationError('That email is already registered.')
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        return User.objects.create_user(**validated_data)

class TokenSerializer(serializers.Serializer):
    refresh = serializers.CharField()
    access = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(
        write_only=True,
        help_text="The email address of the user requesting a password reset.",
        error_messages={'required': 'Email is required.'}
    )

    def validate_email(self, value):
        """
        Ensure the email is associated with an existing user.
        """
        if not User.objects.filter(email__iexact=value).exists():
            # If you prefer not to reveal that the email isn’t registered,
            # you can skip this check and just return success anyway.
            raise serializers.ValidationError("No account found with that email.")
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(
        write_only=True,
        help_text="Base64‐encoded user ID from the reset link.",
        error_messages={'required': 'UID is required.'}
    )
    token = serializers.CharField(
        write_only=True,
        help_text="Password reset token from the reset link.",
        error_messages={'required': 'Token is required.'}
    )
    new_password = serializers.CharField(
        write_only=True,
        validators=[RegexValidator(
            regex=PASSWORD_REGEX,
            message='Password must be ≥8 chars, include a letter, number, and special char.'
        )],
        help_text="The new password.",
        error_messages={'required': 'New password is required.'}
    )
    confirm_password = serializers.CharField(
        write_only=True,
        help_text="Re‐enter the new password for confirmation.",
        error_messages={'required': 'Confirm password is required.'}
    )

    def validate(self, data):
        """
        - Check that `new_password` and `confirm_password` match.
        - Decode `uid` and verify the `token`.
        """
        new_pw = data.get("new_password", "")
        confirm_pw = data.get("confirm_password", "")
        if new_pw != confirm_pw:
            raise serializers.ValidationError("Passwords do not match.")

        # Decode the UID to get the user
        try:
            uid_decoded = smart_str(urlsafe_base64_decode(data.get("uid")))
            user = User.objects.get(pk=uid_decoded)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist, DjangoUnicodeDecodeError):
            raise serializers.ValidationError("Invalid UID.")

        # Check token validity (including TTL from settings.PASSWORD_RESET_TIMEOUT)
        token = data.get("token", "")
        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            raise serializers.ValidationError("Invalid or expired token.")

        # Attach user to validated_data so the view can set the password
        data["user"] = user
        return data

class UpdateProfileSerializer(serializers.Serializer):
    username = serializers.CharField(
        required=True, 
        max_length=150, 
        allow_blank=False,
        error_messages={
            'required': 'Username is required.',
            'blank': 'Username cannot be blank.',
            'max_length': 'Username cannot exceed 150 characters.',
        }
    )
    email = serializers.EmailField(
        required=True, 
        allow_blank=False,
        error_messages={
            'required': 'Email is required.',
            'blank': 'Email cannot be blank.',
            'invalid': 'Please enter a valid email address.',
        }
    )
    full_name = serializers.CharField(
        required=True, 
        max_length=255, 
        allow_blank=False,
        error_messages={
            'required': 'Full name is required.',
            'blank': 'Full name cannot be blank.',
            'max_length': 'Full name cannot exceed 255 characters.',
        }
    )
    bio = serializers.CharField(
        required=False, 
        allow_blank=True,
        error_messages={
            'max_length': 'Bio is too long.',
        }
    )
    avatar = serializers.CharField(
        required=True,
        allow_blank=False,
        allow_null=False,
        help_text="Identifier or URL string for the selected premade avatar.",
        error_messages={
            'required': 'Avatar selection is required.',
            'blank': 'Please select an avatar.',
            'null': 'Avatar cannot be null.',
        }
    )

class StreakSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = Streak
        fields = [
            'count', 
            'longest_streak', 
            'total_days', 
            'last_activity_date',
            'status'
        ]
        read_only_fields = fields
    
    def get_status(self, obj):
        """Include streak status information."""
        return obj.get_streak_status()

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source='user.username', 
        read_only=True
    )
    email = serializers.EmailField(
        source='user.email', 
        read_only=True
    )
    full_name = serializers.CharField(
        required=True, 
        allow_blank=False,
        error_messages={
            'required': 'Full name is required.',
            'blank': 'Full name cannot be blank.',
            'max_length': 'Full name cannot exceed 255 characters.',
        }
    )
    bio = serializers.CharField(
        required=False,
        allow_blank=True,
        error_messages={
            'max_length': 'Bio is too long.',
        }
    )
    avatar = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        error_messages={
            'max_length': 'Avatar identifier is too long.',
        }
    )
    streak = StreakSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = ['username', 'email', 'full_name', 'bio', 'avatar', 'streak']

class UpdateProfileSerializer(serializers.Serializer):
    username = serializers.CharField(
        required=True, 
        max_length=150, 
        allow_blank=False,
        validators=[
            RegexValidator(
                regex=USERNAME_REGEX,
                message=(
                    "Username must be ≥3 chars and can only contain "
                    "letters, numbers, and @/./+/-/_ (no spaces)."
                )
            )
        ],
        error_messages={
            'required': 'Username is required.',
            'blank': 'Username cannot be blank.',
            'max_length': 'Username cannot exceed 150 characters.',
        }
    )
    email = serializers.EmailField(
        required=True, 
        allow_blank=False,
        error_messages={
            'required': 'Email is required.',
            'blank': 'Email cannot be blank.',
            'invalid': 'Please enter a valid email address.',
        }
    )
    full_name = serializers.CharField(
        required=True, 
        max_length=255, 
        allow_blank=False,
        error_messages={
            'required': 'Full name is required.',
            'blank': 'Full name cannot be blank.',
            'max_length': 'Full name cannot exceed 255 characters.',
        }
    )
    bio = serializers.CharField(
        required=False, 
        allow_blank=True,
        error_messages={
            'max_length': 'Bio is too long.',
        }
    )
    avatar = serializers.CharField(
        required=True,
        allow_blank=False,
        allow_null=False,
        help_text="Identifier or URL string for the selected premade avatar.",
        error_messages={
            'required': 'Avatar selection is required.',
            'blank': 'Please select an avatar.',
            'null': 'Avatar cannot be null.',
        }
    )

    def validate_username(self, value):
        """Validate username uniqueness, excluding current user."""
        # Get the current user from the context (passed from the view)
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            raise serializers.ValidationError("Unable to validate username.")
        
        current_user = request.user
        
        # Check if username is taken by another user
        if User.objects.filter(username=value).exclude(pk=current_user.pk).exists():
            raise serializers.ValidationError("That username is already taken.")
        
        return value.strip()

    def validate_email(self, value):
        """Validate email uniqueness, excluding current user."""
        # Get the current user from the context
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            raise serializers.ValidationError("Unable to validate email.")
        
        current_user = request.user
        
        # Check if email is taken by another user (case-insensitive)
        if User.objects.filter(email__iexact=value).exclude(pk=current_user.pk).exists():
            raise serializers.ValidationError("That email is already registered.")
        
        return value.strip()

    def validate(self, data):
        """Cross-field validation."""
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')  # Won't exist in update, but safe to check
        
        # Prevent username/email from being the same (security best practice)
        if username and email and username.lower() == email.lower():
            raise serializers.ValidationError("Username cannot be the same as email.")
        
        return data
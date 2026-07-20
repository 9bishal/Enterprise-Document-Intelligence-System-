from django.http import HttpResponse

class CORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Dynamically exempt all /api/ endpoints from CSRF enforcement for our decoupled frontend
        if request.path.startswith('/api/'):
            request._dont_enforce_csrf_checks = True

        if request.method == "OPTIONS":
            response = HttpResponse()
        else:
            response = self.get_response(request)

        # Allow browser CORS handshakes with credentials from React dev ports
        origin = request.headers.get("Origin")
        allowed_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ]
        if origin in allowed_origins:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken, Authorization"

        return response

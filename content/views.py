from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ContentSection, ContentLink
from .serializers import ContentSectionSerializer, ContentLinkSerializer


class IsFinanceManagerOrReadOnly(permissions.BasePermission):
    """
    Custom permission for content management.
    - GET: All authenticated users
    - POST/PUT/PATCH/DELETE: Users with treasury management permissions (same as Tesoreria)
      Board members, Attivi, or Aspiranti with can_manage_casse flag
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        # Check if user can manage treasury (same permissions as Tesoreria)
        user = request.user
        if not user or not user.is_authenticated:
            return False
        
        # Board and Attivi always have permission
        if user.groups.filter(name__in=['Board', 'Attivi']).exists():
            return True
        
        # Aspiranti with the special flag
        if getattr(user, 'can_manage_casse', False):
            return True
        
        return False


class ContentSectionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ContentSection.
    GET: Available to all authenticated users
    POST/PUT/PATCH/DELETE: Users with treasury management permissions
    """
    queryset = ContentSection.objects.filter(is_active=True).prefetch_related('links')
    serializer_class = ContentSectionSerializer
    permission_classes = [IsFinanceManagerOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def active_sections(self, request):
        """Get all active sections with their links."""
        sections = ContentSection.objects.filter(is_active=True).prefetch_related('links')
        serializer = ContentSectionSerializer(sections, many=True)
        return Response(serializer.data)


class ContentLinkViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ContentLink.
    GET: Available to all authenticated users
    POST/PUT/PATCH/DELETE: Users with treasury management permissions
    """
    queryset = ContentLink.objects.all()
    serializer_class = ContentLinkSerializer
    permission_classes = [IsFinanceManagerOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        section_id = self.request.query_params.get('section', None)
        if section_id:
            queryset = queryset.filter(section_id=section_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

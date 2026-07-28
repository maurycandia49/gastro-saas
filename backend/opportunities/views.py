from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from negocios.models import Negocio
from .engine import OpportunityGenerationBusy, calculate_business_health_score, generate_business_opportunities
from .models import BusinessOpportunity


def get_business(request):
    business_id = request.query_params.get('business_id') or request.data.get('business_id')
    if not business_id:
        return None
    return Negocio.objects.filter(pk=business_id, user=request.user).first()


def opportunity_payload(opportunity):
    return {
        'id': opportunity.id,
        'opportunity_type': opportunity.opportunity_type,
        'category': opportunity.category,
        'title': opportunity.title,
        'message': opportunity.message,
        'severity': opportunity.severity,
        'priority': opportunity.priority,
        'score_impact': opportunity.score_impact,
        'action_label': opportunity.action_label,
        'action_url': opportunity.action_url,
        'metadata': opportunity.metadata,
        'active': opportunity.active,
        'read': opportunity.read,
        'dismissed': opportunity.dismissed,
        'created_at': opportunity.created_at,
        'updated_at': opportunity.updated_at,
        'resolved_at': opportunity.resolved_at,
    }


class OpportunitiesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business = get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        queryset = BusinessOpportunity.objects.filter(negocio=business)
        for field in ['category', 'severity']:
            value = request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        for field in ['read', 'active']:
            value = request.query_params.get(field)
            if value in {'true', 'false'}:
                queryset = queryset.filter(**{field: value == 'true'})
        dismissed = request.query_params.get('dismissed')
        if dismissed in {'true', 'false'}:
            queryset = queryset.filter(dismissed=dismissed == 'true')
        return Response([opportunity_payload(item) for item in queryset.order_by('-priority', '-created_at')])


class OpportunityGenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        business = get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            opportunities = generate_business_opportunities(business)
        except OpportunityGenerationBusy as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response([opportunity_payload(item) for item in opportunities])


class OpportunityDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    class PatchSerializer(serializers.Serializer):
        read = serializers.BooleanField(required=False)
        dismissed = serializers.BooleanField(required=False)

    def patch(self, request, opportunity_id):
        opportunity = BusinessOpportunity.objects.filter(pk=opportunity_id, negocio__user=request.user).first()
        if not opportunity:
            return Response({'detail': 'Oportunidad no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.PatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(opportunity, field, value)
        opportunity.save(update_fields=['read', 'dismissed', 'updated_at'])
        return Response(opportunity_payload(opportunity))


class OpportunitySummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business = get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        active = BusinessOpportunity.objects.filter(negocio=business, active=True, dismissed=False)
        last = BusinessOpportunity.objects.filter(negocio=business).order_by('-updated_at').first()
        return Response({
            'active_count': active.count(),
            'critical_count': active.filter(severity='critical').count(),
            'warning_count': active.filter(severity='warning').count(),
            'success_count': active.filter(severity='success').count(),
            'unread_count': active.filter(read=False).count(),
            'top_opportunities': [opportunity_payload(item) for item in active.order_by('-priority', '-created_at')[:3]],
            'last_generated_at': last.updated_at if last else None,
        })


class BusinessHealthView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        business = get_business(request)
        if not business:
            return Response({'detail': 'Negocio no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(calculate_business_health_score(business))

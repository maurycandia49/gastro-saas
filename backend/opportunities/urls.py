from django.urls import path

from .views import BusinessHealthView, OpportunitiesView, OpportunityDetailView, OpportunityGenerateView, OpportunitySummaryView

urlpatterns = [
    path('opportunities/', OpportunitiesView.as_view(), name='opportunities'),
    path('opportunities/generate/', OpportunityGenerateView.as_view(), name='opportunities_generate'),
    path('opportunities/summary/', OpportunitySummaryView.as_view(), name='opportunities_summary'),
    path('opportunities/<int:opportunity_id>/', OpportunityDetailView.as_view(), name='opportunity_detail'),
    path('business-health/', BusinessHealthView.as_view(), name='business_health'),
]

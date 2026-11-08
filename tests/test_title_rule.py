import pytest

from pipeline.title_rule import is_in_role


@pytest.mark.parametrize("title", [
    "Financial Analyst", "Sr Financial Analyst - RCM Controllership",
    "Senior Analyst, Finance", "Analyst, Finance", "FP&A Manager", "FP&A Analyst II",
    "Cost Accounting Analyst", "Treasury Analyst", "Pricing Analyst", "Credit Analyst",
    "Product Cost Analyst - Taiwan", "Finance Business Partner Analyst"])
def test_in_role(title):
    assert is_in_role(title)


@pytest.mark.parametrize("title", [
    "Data Analyst", "Demand Planning Analyst", "Senior Analyst - Analytics",
    "Software Engineer", "Director, Financial Analysis", "VP of Finance",
    "Finance Intern", "Financial Advisor", "Poultry Selection Worker", "", None])
def test_not_in_role(title):
    assert not is_in_role(title)


def test_case_insensitive():
    assert is_in_role("FINANCIAL ANALYST")

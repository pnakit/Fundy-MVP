import json

def main(aggregated_evaluations) -> dict:
    """
    Calculate maturity score from evaluation results.

    Input: Array of 10 category evaluation objects from Variable Aggregator.

    NOTE: Dify's Variable Aggregator may output either:
      - Array[Object]  → a Python list  (Array mode)
      - Object{k: v}   → a Python dict  (Object mode, badge shows "OBJECT")
    Both are normalised to a list before processing.
    """

    # Normalise: handle String (Dify test panel), dict (Object mode), list (Array mode)
    if isinstance(aggregated_evaluations, str):
        aggregated_evaluations = json.loads(aggregated_evaluations)
    if isinstance(aggregated_evaluations, dict):
        aggregated_evaluations = list(aggregated_evaluations.values())
    # Filter to only dict items — excludes scalar values (e.g. user_id string if accidentally included)
    aggregated_evaluations = [item for item in aggregated_evaluations if isinstance(item, dict)]

    # Category weights for maturity calculation
    # Higher weight = stronger signal of business maturity
    MATURITY_WEIGHTS = {
        "market_traction": 0.25,      # Revenue/customers = strongest signal
        "financial_health": 0.20,      # Financial metrics indicate stage
        "business_model": 0.15,        # Unit economics validation
        "product_technology": 0.15,    # Product development stage
        "go_to_market": 0.10,          # GTM maturity
        "fundraising_capital": 0.05,   # Prior funding indicates stage
        "operations": 0.05,            # Operational maturity
        "team_organization": 0.03,     # Team build-out
        "competitive_position": 0.02,  # Market position
        "legal_compliance": 0.00       # Not a maturity indicator
    }

    # Parse evaluations into lookup
    category_scores = {}
    category_details = {}
    total_completeness = 0

    for eval_result in aggregated_evaluations:
        cat_id = eval_result.get("category_id")
        completeness = eval_result.get("completeness", 0)

        category_scores[cat_id] = completeness
        category_details[cat_id] = {
            "completeness": completeness,
            "status": eval_result.get("status"),
            "highlights": eval_result.get("highlights", []),
            "gaps": eval_result.get("gaps", []),
            "summary": eval_result.get("summary", "")
        }
        total_completeness += completeness

    # Calculate weighted maturity score (0-1000 scale)
    weighted_sum = sum(category_scores.get(cat_id, 0) * weight for cat_id, weight in MATURITY_WEIGHTS.items())

    # Scale to 1-1000 (weighted_sum is 0-100, multiply by 10)
    maturity_score = max(1, round(weighted_sum * 10))

    # Classify maturity stage
    if maturity_score <= 200:
        maturity_stage = "concept"
        maturity_label = "Concept (1-200)"
    elif maturity_score <= 400:
        maturity_stage = "early_traction"
        maturity_label = "Early Traction (201-400)"
    elif maturity_score <= 600:
        maturity_stage = "validated"
        maturity_label = "Validated (401-600)"
    elif maturity_score <= 800:
        maturity_stage = "scaling"
        maturity_label = "Scaling (601-800)"
    else:
        maturity_stage = "market_leader"
        maturity_label = "Market Leader (801-1000)"

    # Calculate overall performance (average completeness)
    num_categories = len(aggregated_evaluations) if aggregated_evaluations else 1
    overall_completeness = round(total_completeness / num_categories)

    # Classify performance level
    if overall_completeness >= 80:
        performance_level = "exceptional"
        performance_label = "Exceptional Performance"
    elif overall_completeness >= 65:
        performance_level = "good"
        performance_label = "Good"
    elif overall_completeness >= 50:
        performance_level = "average"
        performance_label = "Average"
    elif overall_completeness >= 35:
        performance_level = "fair"
        performance_label = "Fair"
    else:
        performance_level = "poor"
        performance_label = "Poor"

    # Identify strongest and weakest categories for feedback
    sorted_by_score = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
    strongest_categories = [cat for cat, score in sorted_by_score[:3]]
    weakest_categories = [cat for cat, score in sorted_by_score[-3:] if score < 70]

    return {
        "maturity_score": maturity_score,
        "maturity_stage": maturity_stage,
        "maturity_label": maturity_label,
        "overall_completeness": overall_completeness,
        "performance_level": performance_level,
        "performance_label": performance_label,
        "category_scores": json.dumps(category_scores),
        "category_details": json.dumps(category_details),
        "strongest_categories": json.dumps(strongest_categories),
        "weakest_categories": json.dumps(weakest_categories)
    }

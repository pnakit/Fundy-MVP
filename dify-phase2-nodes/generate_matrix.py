import json

def main(maturity_stage: str, performance_level: str, category_scores: str, category_details: str) -> dict:
    scores = json.loads(category_scores)
    details = json.loads(category_details)

    INVESTMENT_TYPES = {
        "grant_funding": {
            "name": "Grant Funding",
            "typical_size": "Varies",
            "characteristics": "Non-dilutive capital, mission/impact-focused, higher tolerance for early-stage risk",
            "key_requirements": ["Mission alignment", "Social/scientific impact potential", "Innovation"],
            "priority_categories": ["product_technology", "team_organization", "competitive_position"]
        },
        "pre_seed": {
            "name": "Pre-Seed Investment",
            "typical_size": "$50K-500K",
            "characteristics": "Highest risk tolerance, investing in team and vision, expect 100x+ returns",
            "key_requirements": ["Exceptional team", "Large market opportunity", "Novel insight or unfair advantage"],
            "priority_categories": ["team_organization", "product_technology", "competitive_position", "market_traction"]
        },
        "seed": {
            "name": "Seed Investment",
            "typical_size": "$500K-5M",
            "characteristics": "High risk tolerance, need evidence of PMF, expect 20-50x returns",
            "key_requirements": ["PMF signals", "Early revenue ($10K-100K ARR)", "Repeatable customer acquisition"],
            "priority_categories": ["market_traction", "product_technology", "business_model", "team_organization"]
        },
        "series_a": {
            "name": "Series A Investment",
            "typical_size": "$3-20M",
            "characteristics": "Moderate-high risk, need proven PMF and unit economics, expect 10-20x returns",
            "key_requirements": ["Proven PMF", "Strong unit economics (LTV:CAC >3:1)", "$150K-2M ARR"],
            "priority_categories": ["market_traction", "business_model", "financial_health", "go_to_market"]
        },
        "venture_debt": {
            "name": "Venture Debt",
            "typical_size": "$1-10M+",
            "characteristics": "Low risk tolerance, requires predictable cash flows, covenant compliance",
            "key_requirements": ["Predictable revenue", "Recent equity raise", "Strong retention"],
            "priority_categories": ["financial_health", "market_traction", "operations", "business_model"]
        },
        "revenue_based_financing": {
            "name": "Revenue-Based Financing",
            "typical_size": "$50K-5M",
            "characteristics": "Moderate risk tolerance, repaid from % of revenue, no equity dilution",
            "key_requirements": ["Consistent revenue", "Good growth (>7% MoM)", "Predictable cash flows"],
            "priority_categories": ["market_traction", "financial_health", "business_model"]
        }
    }

    MATRIX = {
        "grant_funding": {
            "concept": {
                "exceptional": {"rating": "ideal", "rationale": "Outstanding team tackling important problem with innovative approach. Mission-aligned with clear social/scientific impact."},
                "good": {"rating": "strong_fit", "rationale": "Good team with compelling mission. Clear path to impact if successful."},
                "average": {"rating": "acceptable", "rationale": "Reasonable team and mission alignment. May need additional support/mentorship."},
                "fair": {"rating": "marginal", "rationale": "Team/mission concerns but high potential impact may justify risk."},
                "poor": {"rating": "not_suitable", "rationale": "Too high risk even for grant capital. Fundamental capability concerns."}
            },
            "early_traction": {
                "exceptional": {"rating": "ideal", "rationale": "Exceptional early validation. Demonstrating impact and commercial potential."},
                "good": {"rating": "strong_fit", "rationale": "Good early traction. Clear mission advancement."},
                "average": {"rating": "acceptable", "rationale": "Making progress on mission. May benefit from grant support."},
                "fair": {"rating": "marginal", "rationale": "Limited progress but may be tackling difficult problem."},
                "poor": {"rating": "not_suitable", "rationale": "Struggling despite being past concept stage."}
            },
            "validated": {
                "exceptional": {"rating": "strong_fit", "rationale": "Proven impact at scale. Ideal for expansion grants."},
                "good": {"rating": "acceptable", "rationale": "Solid progress. Grants for specific initiatives."},
                "average": {"rating": "marginal", "rationale": "Should be self-sustaining or raise commercial capital."},
                "fair": {"rating": "not_suitable", "rationale": "Should be past grant stage."},
                "poor": {"rating": "not_suitable", "rationale": "Should be past grant stage."}
            },
            "scaling": {
                "exceptional": {"rating": "conditional", "rationale": "Only for specific public benefit initiatives."},
                "good": {"rating": "conditional", "rationale": "Specific initiatives only."},
                "average": {"rating": "not_suitable", "rationale": "Too mature for grants."},
                "fair": {"rating": "not_suitable", "rationale": "Too mature for grants."},
                "poor": {"rating": "not_suitable", "rationale": "Too mature for grants."}
            },
            "market_leader": {
                "exceptional": {"rating": "conditional", "rationale": "Government contracts, R&D partnerships only."},
                "good": {"rating": "not_suitable", "rationale": "Too mature."},
                "average": {"rating": "not_suitable", "rationale": "Too mature."},
                "fair": {"rating": "not_suitable", "rationale": "Too mature."},
                "poor": {"rating": "not_suitable", "rationale": "Too mature."}
            }
        },
        "pre_seed": {
            "concept": {
                "exceptional": {"rating": "ideal", "rationale": "World-class founding team, massive market opportunity, novel insight."},
                "good": {"rating": "strong_fit", "rationale": "Strong team with relevant experience, large market, compelling vision."},
                "average": {"rating": "marginal", "rationale": "Team/progress adequate but not standout. High risk."},
                "fair": {"rating": "not_suitable", "rationale": "Too many concerns for institutional pre-seed."},
                "poor": {"rating": "not_suitable", "rationale": "Fundamental issues too severe."}
            },
            "early_traction": {
                "exceptional": {"rating": "ideal", "rationale": "Exceptional early validation, strong PMF signals."},
                "good": {"rating": "strong_fit", "rationale": "Good early traction validating concept."},
                "average": {"rating": "acceptable", "rationale": "Making progress, would benefit from pre-seed capital."},
                "fair": {"rating": "marginal", "rationale": "Below average performance concerning."},
                "poor": {"rating": "not_suitable", "rationale": "Struggling suggests fundamental issues."}
            },
            "validated": {
                "exceptional": {"rating": "conditional", "rationale": "Too mature. Should raise seed/Series A."},
                "good": {"rating": "not_suitable", "rationale": "Too mature for pre-seed."},
                "average": {"rating": "not_suitable", "rationale": "Too mature for pre-seed."},
                "fair": {"rating": "not_suitable", "rationale": "Too mature for pre-seed."},
                "poor": {"rating": "not_suitable", "rationale": "Too mature for pre-seed."}
            },
            "scaling": {
                "exceptional": {"rating": "not_suitable", "rationale": "Far too mature."},
                "good": {"rating": "not_suitable", "rationale": "Far too mature."},
                "average": {"rating": "not_suitable", "rationale": "Far too mature."},
                "fair": {"rating": "not_suitable", "rationale": "Far too mature."},
                "poor": {"rating": "not_suitable", "rationale": "Far too mature."}
            },
            "market_leader": {
                "exceptional": {"rating": "not_suitable", "rationale": "Far too mature."},
                "good": {"rating": "not_suitable", "rationale": "Far too mature."},
                "average": {"rating": "not_suitable", "rationale": "Far too mature."},
                "fair": {"rating": "not_suitable", "rationale": "Far too mature."},
                "poor": {"rating": "not_suitable", "rationale": "Far too mature."}
            }
        },
        "seed": {
            "concept": {
                "exceptional": {"rating": "conditional", "rationale": "Only if truly exceptional team and massive opportunity."},
                "good": {"rating": "not_suitable", "rationale": "Too early. Should raise pre-seed."},
                "average": {"rating": "not_suitable", "rationale": "Too early for seed."},
                "fair": {"rating": "not_suitable", "rationale": "Too early for seed."},
                "poor": {"rating": "not_suitable", "rationale": "Too early for seed."}
            },
            "early_traction": {
                "exceptional": {"rating": "ideal", "rationale": "$50-100K ARR, strong PMF signals, exceptional execution."},
                "good": {"rating": "strong_fit", "rationale": "$25-50K ARR, good PMF signals, team executing well."},
                "average": {"rating": "acceptable", "rationale": "$10-25K ARR, PMF emerging, team functional."},
                "fair": {"rating": "marginal", "rationale": "Concerning performance but may be in difficult market."},
                "poor": {"rating": "not_suitable", "rationale": "Struggling too much for seed."}
            },
            "validated": {
                "exceptional": {"rating": "ideal", "rationale": "$750K-2M ARR, exceptional unit economics, clear scaling path."},
                "good": {"rating": "strong_fit", "rationale": "$350-750K ARR, good economics, proven repeatability."},
                "average": {"rating": "acceptable", "rationale": "$150-350K ARR, economics validated."},
                "fair": {"rating": "marginal", "rationale": "Too mature to perform below average. Red flag."},
                "poor": {"rating": "not_suitable", "rationale": "Fundamental business model issues likely."}
            },
            "scaling": {
                "exceptional": {"rating": "conditional", "rationale": "$2M+ ARR but hasn't raised Series A. Unusual."},
                "good": {"rating": "not_suitable", "rationale": "Too mature for seed."},
                "average": {"rating": "not_suitable", "rationale": "Too mature for seed."},
                "fair": {"rating": "not_suitable", "rationale": "Too mature for seed."},
                "poor": {"rating": "not_suitable", "rationale": "Too mature for seed."}
            },
            "market_leader": {
                "exceptional": {"rating": "not_suitable", "rationale": "Far too mature."},
                "good": {"rating": "not_suitable", "rationale": "Far too mature."},
                "average": {"rating": "not_suitable", "rationale": "Far too mature."},
                "fair": {"rating": "not_suitable", "rationale": "Far too mature."},
                "poor": {"rating": "not_suitable", "rationale": "Far too mature."}
            }
        },
        "series_a": {
            "concept": {
                "exceptional": {"rating": "not_suitable", "rationale": "Far too early."},
                "good": {"rating": "not_suitable", "rationale": "Far too early."},
                "average": {"rating": "not_suitable", "rationale": "Far too early."},
                "fair": {"rating": "not_suitable", "rationale": "Far too early."},
                "poor": {"rating": "not_suitable", "rationale": "Far too early."}
            },
            "early_traction": {
                "exceptional": {"rating": "conditional", "rationale": "Only if truly exceptional. 'Preemptive Series A'."},
                "good": {"rating": "not_suitable", "rationale": "Too early, should raise seed."},
                "average": {"rating": "not_suitable", "rationale": "Too early for Series A."},
                "fair": {"rating": "not_suitable", "rationale": "Too early for Series A."},
                "poor": {"rating": "not_suitable", "rationale": "Too early for Series A."}
            },
            "validated": {
                "exceptional": {"rating": "ideal", "rationale": "$750K-2M ARR, LTV:CAC >4:1, <3% churn."},
                "good": {"rating": "strong_fit", "rationale": "$350-750K ARR, LTV:CAC 3-4:1, good retention."},
                "average": {"rating": "acceptable", "rationale": "$150-350K ARR, LTV:CAC 2-3:1, PMF proven."},
                "fair": {"rating": "marginal", "rationale": "Below average performance concerning. High risk."},
                "poor": {"rating": "not_suitable", "rationale": "Not ready for Series A scale capital."}
            },
            "scaling": {
                "exceptional": {"rating": "ideal", "rationale": "$8-20M ARR, strong growth, excellent economics."},
                "good": {"rating": "strong_fit", "rationale": "$4-8M ARR, good growth/economics."},
                "average": {"rating": "acceptable", "rationale": "$2-4M ARR, solid performance."},
                "fair": {"rating": "marginal", "rationale": "Below average very concerning at this scale."},
                "poor": {"rating": "not_suitable", "rationale": "Serious business model or execution problems."}
            },
            "market_leader": {
                "exceptional": {"rating": "conditional", "rationale": "Should raise Series B/C instead."},
                "good": {"rating": "not_suitable", "rationale": "Too mature for Series A."},
                "average": {"rating": "not_suitable", "rationale": "Too mature for Series A."},
                "fair": {"rating": "not_suitable", "rationale": "Too mature for Series A."},
                "poor": {"rating": "not_suitable", "rationale": "Too mature for Series A."}
            }
        },
        "venture_debt": {
            "concept": {
                "exceptional": {"rating": "not_suitable", "rationale": "No revenue, can't service debt."},
                "good": {"rating": "not_suitable", "rationale": "No revenue."},
                "average": {"rating": "not_suitable", "rationale": "No revenue."},
                "fair": {"rating": "not_suitable", "rationale": "No revenue."},
                "poor": {"rating": "not_suitable", "rationale": "No revenue."}
            },
            "early_traction": {
                "exceptional": {"rating": "conditional", "rationale": "$50-100K ARR, just raised equity, debt extends runway."},
                "good": {"rating": "not_suitable", "rationale": "Too early, revenue unpredictable."},
                "average": {"rating": "not_suitable", "rationale": "Too early."},
                "fair": {"rating": "not_suitable", "rationale": "Too early."},
                "poor": {"rating": "not_suitable", "rationale": "Too early."}
            },
            "validated": {
                "exceptional": {"rating": "strong_fit", "rationale": "$750K-2M ARR, strong growth, just raised Series A."},
                "good": {"rating": "acceptable", "rationale": "$350-750K ARR, good growth, raised equity."},
                "average": {"rating": "marginal", "rationale": "$150-350K ARR, less predictable. Higher risk."},
                "fair": {"rating": "not_suitable", "rationale": "Debt service risky. Could accelerate failure."},
                "poor": {"rating": "not_suitable", "rationale": "Debt would be dangerous."}
            },
            "scaling": {
                "exceptional": {"rating": "ideal", "rationale": "$8-20M ARR, predictable, strong economics."},
                "good": {"rating": "strong_fit", "rationale": "$4-8M ARR, good predictability."},
                "average": {"rating": "acceptable", "rationale": "$2-4M ARR, reasonable predictability."},
                "fair": {"rating": "marginal", "rationale": "Debt could stress company."},
                "poor": {"rating": "not_suitable", "rationale": "Debt would strain company."}
            },
            "market_leader": {
                "exceptional": {"rating": "ideal", "rationale": "$30M+ ARR, highly predictable, best debt terms."},
                "good": {"rating": "strong_fit", "rationale": "$20-30M ARR, good predictability."},
                "average": {"rating": "acceptable", "rationale": "$10-20M ARR, reasonable predictability."},
                "fair": {"rating": "marginal", "rationale": "Below average concerning for debt providers."},
                "poor": {"rating": "not_suitable", "rationale": "Serious concerns about debt service."}
            }
        },
        "revenue_based_financing": {
            "concept": {
                "exceptional": {"rating": "not_suitable", "rationale": "No revenue to base repayment on."},
                "good": {"rating": "not_suitable", "rationale": "No revenue."},
                "average": {"rating": "not_suitable", "rationale": "No revenue."},
                "fair": {"rating": "not_suitable", "rationale": "No revenue."},
                "poor": {"rating": "not_suitable", "rationale": "No revenue."}
            },
            "early_traction": {
                "exceptional": {"rating": "strong_fit", "rationale": "$50-100K ARR, >10% MoM growth, strong retention."},
                "good": {"rating": "acceptable", "rationale": "$25-50K ARR, >7% MoM growth."},
                "average": {"rating": "marginal", "rationale": "$10-25K ARR, moderate growth. Higher risk."},
                "fair": {"rating": "not_suitable", "rationale": "Revenue too unpredictable."},
                "poor": {"rating": "not_suitable", "rationale": "RBF payments would strain revenue."}
            },
            "validated": {
                "exceptional": {"rating": "ideal", "rationale": "$750K-2M ARR, strong growth, excellent retention."},
                "good": {"rating": "strong_fit", "rationale": "$350-750K ARR, consistent growth, good retention."},
                "average": {"rating": "acceptable", "rationale": "$150-350K ARR, acceptable growth/retention."},
                "fair": {"rating": "marginal", "rationale": "Below average growth concerning."},
                "poor": {"rating": "not_suitable", "rationale": "Declining or stalled revenue problematic."}
            },
            "scaling": {
                "exceptional": {"rating": "ideal", "rationale": "$8-20M ARR, high growth, excellent visibility."},
                "good": {"rating": "strong_fit", "rationale": "$4-8M ARR, strong growth."},
                "average": {"rating": "acceptable", "rationale": "$2-4M ARR, acceptable terms."},
                "fair": {"rating": "marginal", "rationale": "Revenue share could impact operations."},
                "poor": {"rating": "not_suitable", "rationale": "Not appropriate for RBF."}
            },
            "market_leader": {
                "exceptional": {"rating": "ideal", "rationale": "$30M+ ARR, best RBF terms. Alternative to equity."},
                "good": {"rating": "strong_fit", "rationale": "$20-30M ARR, project-specific RBF."},
                "average": {"rating": "acceptable", "rationale": "$10-20M ARR, acceptable for RBF."},
                "fair": {"rating": "marginal", "rationale": "Revenue share could impact operations."},
                "poor": {"rating": "not_suitable", "rationale": "Not appropriate for RBF."}
            }
        }
    }

    recommendations = {}
    for inv_type, inv_info in INVESTMENT_TYPES.items():
        rec = MATRIX[inv_type][maturity_stage][performance_level]
        priority_scores = {}
        improvement_areas = []
        for cat in inv_info["priority_categories"]:
            cat_score = scores.get(cat, 0)
            priority_scores[cat] = cat_score
            if cat_score < 70:
                cat_detail = details.get(cat, {})
                improvement_areas.append({
                    "category": cat,
                    "current_score": cat_score,
                    "gaps": cat_detail.get("gaps", [])
                })
        recommendations[inv_type] = {
            "name": inv_info["name"],
            "typical_size": inv_info["typical_size"],
            "rating": rec["rating"],
            "rationale": rec["rationale"],
            "key_requirements": inv_info["key_requirements"],
            "priority_category_scores": priority_scores,
            "improvement_areas": improvement_areas[:3]
        }

    suitable = [k for k, v in recommendations.items() if v["rating"] in ["ideal", "strong_fit", "acceptable"]]
    conditional = [k for k, v in recommendations.items() if v["rating"] in ["conditional", "marginal"]]
    not_suitable = [k for k, v in recommendations.items() if v["rating"] == "not_suitable"]

    return {
        "recommendations_json": json.dumps(recommendations),
        "suitable_types": json.dumps(suitable),
        "conditional_types": json.dumps(conditional),
        "not_suitable_types": json.dumps(not_suitable),
        "suitable_count": len(suitable),
        "conditional_count": len(conditional)
    }

def calculate_result_category(total_score: int, max_possible_score: int) -> str:
    if max_possible_score == 0:
        return "Unknown"

    ratio = total_score / max_possible_score

    if ratio < 0.25:
        return "Minimal"
    elif ratio < 0.5:
        return "Mild"
    elif ratio < 0.75:
        return "Moderate"
    else:
        return "Severe"
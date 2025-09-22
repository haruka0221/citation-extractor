#!/usr/bin/env python3
"""
Debug script to test line extraction logic
"""

def test_line_indexing():
    """Test the line indexing logic"""

    print("🔍 DEBUGGING LINE EXTRACTION LOGIC")
    print("=" * 50)

    # Sample text data (simulating the Absalom and Achitophel file)
    sample_lines = [
        "Absalom and Achitophel",        # Line 1 (index 0)
        "By John Dryden",                # Line 2 (index 1)
        "",                              # Line 3 (index 2)
        "Of these the false Achitophel was first,",  # Line 4 (index 3)
        "A name to all succeeding ages curst.",      # Line 5 (index 4)
        "For close designs and crooked counsels fit,",  # Line 6 (index 5)
        "Sagacious, bold, and turbulent of wit,",       # Line 7 (index 6) ← TARGET
        "Restless, unfixed in principles and place,",   # Line 8 (index 7) ← TARGET
        "In power unpleased, impatient of disgrace;",   # Line 9 (index 8)
        "A fiery soul, which working out its way,",     # Line 10 (index 9)
    ]

    print(f"📊 Sample data has {len(sample_lines)} lines")
    print("\n📋 Line numbering reference:")
    for i, line in enumerate(sample_lines):
        line_num = i + 1
        print(f"  Line {line_num:2} (index {i}): {line}")

    print(f"\n🎯 TARGET: Extract lines 7-8")
    print(f"Expected content:")
    print(f"  Line 7: 'Sagacious, bold, and turbulent of wit,'")
    print(f"  Line 8: 'Restless, unfixed in principles and place,'")

    # Test current logic
    print(f"\n🔧 TESTING CURRENT LOGIC")
    start_line = 7
    end_line = 8

    print(f"Input: start_line={start_line}, end_line={end_line}")

    # Current implementation: lines[start_line-1:end_line]
    start_index = start_line - 1  # 7-1 = 6
    end_index = end_line          # 8

    print(f"Current logic: lines[{start_index}:{end_index}]")

    extracted_current = sample_lines[start_index:end_index]
    print(f"Current result: {extracted_current}")

    # Check if this is correct
    expected_lines = [
        "Sagacious, bold, and turbulent of wit,",       # Line 7
        "Restless, unfixed in principles and place,",   # Line 8
    ]

    if extracted_current == expected_lines:
        print("✅ Current logic is CORRECT")
    else:
        print("❌ Current logic is WRONG")
        print(f"Expected: {expected_lines}")
        print(f"Got:      {extracted_current}")

    # Test what we should get with correct indexing
    print(f"\n🔧 TESTING CORRECT LOGIC")
    # For 1-based lines 7-8, we want 0-based indices 6-7
    correct_start = start_line - 1    # 6
    correct_end = end_line           # 8 (exclusive end for slice)

    print(f"Correct logic: lines[{correct_start}:{correct_end}]")
    extracted_correct = sample_lines[correct_start:correct_end]
    print(f"Correct result: {extracted_correct}")

    if extracted_correct == expected_lines:
        print("✅ Corrected logic is RIGHT")
        return True
    else:
        print("❌ Still wrong - need different approach")
        return False

def test_actual_file():
    """Test with the actual Absalom and Achitophel file"""

    print(f"\n📄 TESTING WITH ACTUAL FILE")
    print("=" * 50)

    try:
        with open('test_corpus/cleaned/absalom_achitophel_sample.txt', 'r', encoding='utf-8') as f:
            lines = f.readlines()

        print(f"File has {len(lines)} lines")

        # Show lines around 7-8
        print(f"\nLines 5-10 from file:")
        for i in range(4, min(10, len(lines))):  # Lines 5-10 (indices 4-9)
            line_num = i + 1
            content = lines[i].rstrip('\n')
            marker = " ← TARGET" if line_num in [7, 8] else ""
            print(f"  Line {line_num:2}: {content}{marker}")

        # Test extraction of lines 7-8
        start_line = 7
        end_line = 8

        # Current logic
        passage_lines_current = lines[start_line-1:end_line]
        print(f"\n🔧 Current extraction logic:")
        print(f"lines[{start_line-1}:{end_line}] gives:")
        for i, line in enumerate(passage_lines_current):
            print(f"  {i}: {line.rstrip()}")

        # What should be the result
        expected_line_7 = lines[6].rstrip()  # Index 6 = Line 7
        expected_line_8 = lines[7].rstrip()  # Index 7 = Line 8

        print(f"\n✅ EXPECTED RESULT:")
        print(f"  Line 7: {expected_line_7}")
        print(f"  Line 8: {expected_line_8}")

        # Check if current logic gives correct result
        actual_results = [line.rstrip() for line in passage_lines_current]
        expected_results = [expected_line_7, expected_line_8]

        print(f"\n🎯 COMPARISON:")
        print(f"Expected: {expected_results}")
        print(f"Actual:   {actual_results}")

        if actual_results == expected_results:
            print("✅ Extraction is CORRECT!")
            return True
        else:
            print("❌ Extraction is WRONG!")
            return False

    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False

def test_edge_cases():
    """Test edge cases"""

    print(f"\n🧪 TESTING EDGE CASES")
    print("=" * 50)

    test_cases = [
        (1, 1, "Single line (first line)"),
        (5, 5, "Single line (middle)"),
        (7, 8, "Two consecutive lines"),
        (1, 3, "Range from beginning"),
        (10, 12, "Range near end"),
    ]

    # Sample data
    sample_lines = [f"Line {i+1} content" for i in range(20)]

    for start, end, description in test_cases:
        print(f"\n📋 Test: {description}")
        print(f"Input: lines {start}-{end}")

        if start <= len(sample_lines) and end <= len(sample_lines):
            # Current logic
            extracted = sample_lines[start-1:end]

            print(f"Current logic gives {len(extracted)} lines:")
            for line in extracted:
                print(f"  {line}")

            # Verify it's correct
            expected_count = end - start + 1
            if len(extracted) == expected_count:
                print(f"✅ Correct count ({expected_count} lines)")
            else:
                print(f"❌ Wrong count (expected {expected_count}, got {len(extracted)})")
        else:
            print(f"❌ Range out of bounds")

if __name__ == "__main__":
    print("🚀 STARTING LINE EXTRACTION DEBUG")
    print("=" * 60)

    success = True

    # Test 1: Logic verification
    if not test_line_indexing():
        success = False

    # Test 2: Actual file
    if not test_actual_file():
        success = False

    # Test 3: Edge cases
    test_edge_cases()

    if success:
        print(f"\n🎉 LINE EXTRACTION LOGIC IS CORRECT!")
        print("The issue may be elsewhere in the pipeline.")
    else:
        print(f"\n❌ LINE EXTRACTION LOGIC NEEDS FIXING!")
        print("Found issues in the indexing logic.")

    print(f"\n🏁 Debug complete!")
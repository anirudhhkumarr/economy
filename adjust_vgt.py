import csv
import sys

def process_value(val, multiplier=1, divisor=1):
    val = val.strip()
    if val in ("--", "-", ""):
        return val
    
    is_currency = False
    if val.startswith('$'):
        is_currency = True
        val = val[1:]
        
    val_parsed = val.replace(',', '')
    
    try:
        num = float(val_parsed)
        num = (num * multiplier) / divisor
        
        formatted = f"{num:.6f}"
        if '.' in formatted:
            formatted = formatted.rstrip('0').rstrip('.')
            
        if is_currency:
            return "$" + formatted
        else:
            return formatted
    except ValueError:
        return val

lines = []
with open('../stocks/csv/VGT.csv', 'r', encoding='utf-8') as f:
    lines = f.readlines()

header1 = lines[0]
header2 = lines[1]

parsed_rows = []
reader = csv.reader(lines[2:])
for line in reader:
    if not line:
        parsed_rows.append(line)
        continue
        
    date_val = line[0]
    
    if date_val == "Total":
        line[2] = process_value(line[2], multiplier=8)
    elif date_val == "Open Date":
        pass
    else:
        line[2] = process_value(line[2], multiplier=8)
        line[3] = process_value(line[3], divisor=8)
        line[4] = process_value(line[4], divisor=8)
        line[5] = process_value(line[5], divisor=8)
        
    parsed_rows.append(line)

with open('../stocks/csv/VGT.csv', 'w', encoding='utf-8', newline='') as f:
    f.write(header1)
    f.write(header2)
    writer = csv.writer(f, quoting=csv.QUOTE_ALL)
    for row in parsed_rows:
        if not row:
            f.write('\n')
        else:
            writer.writerow(row)

print("VGT.csv adjusted successfully!")

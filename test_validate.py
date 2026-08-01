import csv
with open('../stocks/csv/VGT.csv', 'r') as f:
    lines = list(csv.reader(f))

# Header is row index 2
# row index 3 is first data row
print(lines[2])
print(lines[3])

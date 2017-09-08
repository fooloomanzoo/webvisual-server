############# TEST FILE GENERATOR ##############

import csv
import random
import datetime
import math
from threading import Event, Thread

# output file path
outfile = '../examples/datafile/test.txt'

# mode is "random" or "polynom" or "sinus"
mode = 'sinus'

# numbers in a line
rowlenght = 25

# length of lines to generate in beginning
initialLineLength = 500

# minimum threshold
low = -5
# maximum threshold
high = 5

# round precission
prec = 5

# x-variable tension
tension = 100.0

# csv-format
dateformat = '%d.%m.%Y %H:%M:%S'
valueseperator = ';'

# interval of new numbers in seconds
interval = 1

# if mode is "polynom" then this is used
polynom = [0, 1, 0.5, -1/6, 1/24, -1/120, 1/720]

def createRow(t, i, shouldprint):
    with open(outfile, 'a') as csvfile:
        writer = csv.writer(csvfile, delimiter=valueseperator)
        r = [generateNumber(i, j*interval) for j in range(rowlenght)]
        r.insert(0, (t).strftime(dateformat))
        if shouldprint:
            print(r)
        elif i % 1000 == 0:
            print(i)
        writer.writerow(r)

def intervalWrite(interval):
    stopped = Event()
    def loop():
        while not stopped.wait(interval): # the first call is in `interval` secs
            t = datetime.datetime.now()
            createRow(t, secondsDiff(t, started), 1)
    Thread(target=loop).start()
    return stopped.set

def generateNumber(x, shift = 0):
    if mode == 'random':
        y = random.uniform(low, high)
    elif mode == 'polynom':
        y = evalPoly(polynom, x/tension - shift)
    elif mode == 'sinus':
        y = math.sin(x/tension - shift) * (high - low)
    else:
        y = x/tension - shift
    return round(y, prec)

def evalPoly(lst, x):
    total, power = 0, 0
    for coeff in lst:
        total += (x**power) * coeff
        power += 1
    return total

def secondsDiff(a, b):
    c = a - b
    return c.days*86400 + c.seconds

open(outfile, 'w').close()
started = datetime.datetime.now()
for i in range(-initialLineLength, 0):
    createRow(started + datetime.timedelta(seconds=i*interval), i*interval, 0)
intervalWrite(interval)

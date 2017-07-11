import csv
import random
import datetime
from threading import Event, Thread

outfile = '../examples/datafile/test.txt'
dateformat = '%d.%m.%Y %H:%M:%S'
low = -5
high = 5
prec = 5
tension = 1000.0
rowlenght = 25
initialLineLength = 500
valueseperator = ';'
interval = 1
# mode is "random" or "polynom" or "sinus"
mode = 'polynom'
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

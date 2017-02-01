import csv
import random
import datetime
from threading import Event, Thread

outfile = '../examples/datafile/test.txt'
dateformat = '%d.%m.%Y %H:%M:%S'
low = -22
high = 22
prec = 1
rowlenght = 25
initialLineLength = 5000
valueseperator = ';'
interval = 1


def createRow(d, i, shouldprint):
    with open(outfile, 'a') as csvfile:
        writer = csv.writer(csvfile, delimiter=valueseperator)
        r = [round(random.uniform(low, high), prec) for _ in range(rowlenght)]
        r.insert(0, (d + datetime.timedelta(seconds=i)).strftime(dateformat))
        if shouldprint:
            print(r)
        elif i % 1000 == 0:
            print(i)
        writer.writerow(r)


def intervalWrite(interval):
    stopped = Event()
    def loop():
        while not stopped.wait(interval): # the first call is in `interval` secs
            createRow(datetime.datetime.now(), 0, 1)
    Thread(target=loop).start()
    return stopped.set

open(outfile, 'w').close()
d = datetime.datetime.now()
for i in range(-initialLineLength, 0):
    createRow(d, i*interval, 0)
intervalWrite(interval)

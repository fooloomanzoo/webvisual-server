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
initialLineLength = 10000
valueseperator = ';'
interval = 2


def createRow(d, i):
    with open(outfile, 'a') as csvfile:
        writer = csv.writer(csvfile, delimiter=valueseperator)
        r = [round(random.uniform(low, high), prec) for _ in range(rowlenght)]
        r.insert(0, (d + datetime.timedelta(seconds=i)).strftime(dateformat))
        print(r)
        writer.writerow(r)


def intervalWrite(interval):
    stopped = Event()
    def loop():
        while not stopped.wait(interval): # the first call is in `interval` secs
            createRow(datetime.datetime.now(), 0)
    Thread(target=loop).start()
    return stopped.set

open(outfile, 'w').close()
d = datetime.datetime.now()
for i in range(-initialLineLength, 0):
    createRow(d, i*interval)
intervalWrite(interval)

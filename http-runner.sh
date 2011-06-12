#!/bin/bash
e(){ echo "request syntax error" ; echo ; echo ; exit ; }
read line
echo -ne "HTTP/1.0 200 OK\r\n"
echo -ne "Content-type: text/html\r\n"
echo -ne "\r\n"
[ "_$(echo $line| cut -d" " -f 1)" = "_GET" ] || e
echo $line | grep -q "\\\$" || e
# GET /path/to/file HTTP/1.X
path="$(echo $line | cut -d" " -f 2)"
path=${path//"%20"/" "}
path=${path//"%22"/"\""}
run="$(echo -n $path | cut -d"\$" -f 2-)"
if grep -q "^_$(echo $run | cut -d" " -f 1) " /etc/http-runner.conf
  then r=$(grep "^_$(echo $run | cut -d" " -f 1) " /etc/http-runner.conf | cut -d" " -f 2-)
  export HTTP_RUNNER_REQUEST_ARGS="$(echo $run | cut -d" " -f 2-)"
  DISPLAY=:0.0 Xdialog --yesno "Really run alias '$run' ($r)?" 10 100 && bash -c "$r" || echo "denied"
elif grep -q "^$(echo $run | cut -d" " -f 1) " /etc/http-runner.conf
  then r=$(grep "^$(echo $run | cut -d" " -f 1) " /etc/http-runner.conf | cut -d" " -f 2-)
  export HTTP_RUNNER_REQUEST_ARGS="$(echo $run | cut -d" " -f 2-)"
  bash -c "$r"
else
  DISPLAY=:0.0 Xdialog --yesno "Really run command '$run'?" 10 100 && bash -c "$run" || echo "denied"
fi
echo
echo


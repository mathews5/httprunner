#!/bin/bash
e(){ echo -e "HTTP/1.0 500 internal server error\r\n\r\nrequest syntax error" ; echo ; echo ; exit ; }
read line
[ "_$(echo $line| cut -d" " -f 1)" = "_GET" ] || e
[ -f /tmp/http-runner.cookie ] || head -n 2 /dev/urandom | md5sum | cut -d " " -f 1 > /tmp/http-runner.cookie
ALLOWEDCOOKIE="$(cat /tmp/http-runner.cookie 2>/dev/null)"
COOKIERUN="no"
while read line2
  do echo "$line2" | grep -q -v '\w' && break
  echo -n "$line2" | grep -q '^Cookie:.*'$ALLOWEDCOOKIE'.*$' && COOKIERUN="yes"
done

echo $line | grep -q "\\\$" || e
path="$(echo $line | cut -d" " -f 2)"
path=${path//"%20"/" "}
path=${path//"%22"/"\""}
run="$(echo -n $path | cut -d"\$" -f 2-)"
echo -ne "HTTP/1.0 200 OK\r\n"
echo -ne "Content-type: text/html\r\n"
if echo -n "$run" | grep -q 'cake=\w'
  then allow="no"
  DISPLAY=:0.0 Xdialog --yesno "Really allow cookie '$run'?" 10 100 && allow="yes"
  if [ "_$allow" = "_yes" ]
    then echo -n "${run}" > /tmp/http-runner.cookie
    echo -ne "Set-Cookie: ${run}\r\n\r\nCookie set.\r\n"
    exit
  else
    echo -ne "\r\n\r\ndenied\r\n"
  fi
fi
echo -ne "\r\n"
if grep -q "^_$(echo $run | cut -d" " -f 1) " /etc/http-runner.conf
  then r=$(grep "^_$(echo $run | cut -d" " -f 1) " /etc/http-runner.conf | cut -d" " -f 2-)
  export HTTP_RUNNER_REQUEST_ARGS="$(echo $run | cut -d" " -f 2-)"
  [ "_$COOKIERUN" = "_yes" ] && { bash -c "$r" ; exit ; }
  DISPLAY=:0.0 Xdialog --yesno "Really run alias '$run' ($r)?" 10 100 && bash -c "$r" || echo "denied"
elif grep -q "^$(echo $run | cut -d" " -f 1) " /etc/http-runner.conf
  then r=$(grep "^$(echo $run | cut -d" " -f 1) " /etc/http-runner.conf | cut -d" " -f 2-)
  export HTTP_RUNNER_REQUEST_ARGS="$(echo $run | cut -d" " -f 2-)"
  [ "_$COOKIERUN" = "_yes" ] && { bash -c "$r" ; exit ; }
  bash -c "$r"
else
  # we DO NOT WANT to allow every command!
  # [ "_$COOKIERUN" = "_yes" ] && { bash -c "$run" ; exit ; }
  DISPLAY=:0.0 Xdialog --yesno "Really run command '$run'?" 10 100 && bash -c "$run" || echo "denied"
fi
echo
echo


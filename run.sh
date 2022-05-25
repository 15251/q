while true
do
  sudo node index.js |& tee -a log.txt
  echo "Restarting in 5 seconds..."
  sleep 5
done

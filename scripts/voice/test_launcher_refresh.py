"""Launcher optional refresh: mocked process creation, no OBS/service operations."""
from contextlib import redirect_stdout
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import launch


class LauncherRefreshTests(unittest.TestCase):
    def test_hidden_reduced_environment_helper_does_not_wait(self):
        with tempfile.TemporaryDirectory(prefix='voice-refresh-') as folder:
            with patch.object(launch,'CACHE',Path(folder)), patch.object(launch.shutil,'which',return_value=r'C:\Node\node.exe'), patch.object(Path,'is_file',return_value=True), patch.object(launch.subprocess,'Popen') as spawn, patch.dict(os.environ,{'EXAMPLE_API_SECRET':'not-for-child','NODE_OPTIONS':'not-for-child'}):
                launch.refresh_receivers_best_effort()
                spawn.assert_called_once()
                args,options=spawn.call_args
                self.assertTrue(args[0][1].endswith('refresh_obs_receivers.mjs'))
                self.assertNotIn('EXAMPLE_API_SECRET',options['env'])
                self.assertNotIn('NODE_OPTIONS',options['env'])
                self.assertEqual(options['creationflags'],getattr(launch.subprocess,'CREATE_NO_WINDOW',0))
                self.assertNotIn('shell',options)

    def test_missing_node_or_spawn_failure_is_nonfatal(self):
        with patch.object(launch.shutil,'which',return_value=None), patch.object(launch.subprocess,'Popen') as spawn:
            launch.refresh_receivers_best_effort();spawn.assert_not_called()
        with tempfile.TemporaryDirectory(prefix='voice-refresh-') as folder:
            with patch.object(launch,'CACHE',Path(folder)), patch.object(launch.shutil,'which',return_value=r'C:\Node\node.exe'), patch.object(Path,'is_file',return_value=True), patch.object(launch.subprocess,'Popen',side_effect=OSError('Mock unavailable OBS helper')):
                launch.refresh_receivers_best_effort()

    def test_already_running_service_can_recover_receivers_without_restarting(self):
        with patch.object(launch,'health',return_value={'application':'vmodel-voice'}), patch.object(launch,'refresh_receivers_best_effort') as refresh, patch.object(launch.subprocess,'Popen') as spawn, redirect_stdout(io.StringIO()):
            launch.start(open_browser=False)
            refresh.assert_called_once();spawn.assert_not_called()


if __name__=='__main__':unittest.main()
